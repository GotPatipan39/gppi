#!/usr/bin/env node
// ตรวจ flowchart ไฟล์ .drawio (ไม่ต้องติดตั้งอะไรเพิ่ม — ใช้ node ที่ gppi ต้องมีอยู่แล้ว)
//   node check_drawio.mjs <file.drawio>             ตรวจโครงสร้าง: error = exit 1
//   node check_drawio.mjs <file.drawio> --outline   พิมพ์ flowchart เป็นข้อความ (ใช้อ่านไฟล์ที่ผู้ใช้แก้ใน draw.io)
// อ่านได้ทั้งไฟล์แบบไม่บีบอัด และแบบบีบอัด (draw.io บางรุ่นเก็บเนื้อหาเป็น base64 + deflate)
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

const [file, ...flags] = process.argv.slice(2);
if (!file) {
  console.error('usage: node check_drawio.mjs <file.drawio> [--outline]');
  process.exit(2);
}
const outline = flags.includes('--outline');

const decode = (s) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&');
// label แบบ html=1 → ข้อความล้วน
const plain = (s) => decode(decode(s ?? ''))
  .replace(/<br\s*\/?>/gi, ' / ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ').trim();
const attrs = (s) => Object.fromEntries([...s.matchAll(/([\w:-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));

let raw = readFileSync(file, 'utf8');
// .drawio.svg / .drawio.png ที่ export แบบฝัง diagram: เนื้อหาอยู่ใน attribute content ของ <svg>
const embedded = raw.match(/<svg\b[^>]*\bcontent="([^"]*)"/);
if (embedded) raw = decode(embedded[1]);
if (!/<mxfile\b/.test(raw) && !/<mxGraphModel\b/.test(raw)) {
  console.error(`ERROR ${file}: ไม่ใช่ไฟล์ draw.io (ไม่มี <mxfile> หรือ <mxGraphModel>)`);
  process.exit(1);
}

// แยกทีละหน้า (<diagram>) และคลายไฟล์ที่บีบอัด
const pages = [];
for (const m of raw.matchAll(/<diagram\b([^>]*)>([\s\S]*?)<\/diagram>/g)) {
  const name = decode(attrs(m[1]).name ?? `page ${pages.length + 1}`);
  let body = m[2].trim();
  if (body && !body.startsWith('<')) {
    try {
      body = decodeURIComponent(inflateRawSync(Buffer.from(body, 'base64')).toString('latin1'));
    } catch (e) {
      console.error(`ERROR ${file} [${name}]: คลายเนื้อหาที่บีบอัดไม่ได้ (${e.message})`);
      process.exit(1);
    }
  }
  pages.push({ name, body });
}
if (pages.length === 0) pages.push({ name: 'page 1', body: raw });

// กล่องปกติต้องมี width/height — ยกเว้นป้ายของเส้นที่วางแบบ relative
const byIdHasNoSize = (c) =>
  !/edgeLabel/.test(c.style ?? '') && c.geo?.relative !== '1' &&
  !(Number(c.geo?.width) > 0 && Number(c.geo?.height) > 0);

let errors = 0;
let warnings = 0;
for (const { name, body } of pages) {
  const err = (msg) => { errors++; console.log(`ERROR [${name}] ${msg}`); };
  const warn = (msg) => { warnings++; console.log(`WARN  [${name}] ${msg}`); };

  // เก็บ mxCell ทุกตัวพร้อม geometry — ตัวที่ห่อด้วย <object>/<UserObject> ใช้ id/label จากตัวห่อ
  const cells = [];
  const cellRe = /<(object|UserObject)\b([^>]*)>\s*<mxCell\b([^>]*?)(?:\/>|>([\s\S]*?)<\/mxCell>)\s*<\/\1>|<mxCell\b([^>]*?)(?:\/>|>([\s\S]*?)<\/mxCell>)/g;
  for (const m of body.matchAll(cellRe)) {
    const wrapped = Boolean(m[1]);
    const c = attrs(wrapped ? m[3] : m[5]);
    const inner = (wrapped ? m[4] : m[6]) ?? '';
    if (wrapped) {
      const w = attrs(m[2]);
      c.id = w.id;
      c.value = w.label ?? c.value;
    }
    const g = inner.match(/<mxGeometry\b([^>]*?)\/?>/);
    c.geo = g ? attrs(g[1]) : null;
    const arr = inner.match(/<Array\b[^>]*as="points"[^>]*>([\s\S]*?)<\/Array>/);
    c.points = arr ? [...arr[1].matchAll(/<mxPoint\b([^>]*?)\/?>/g)].map((p) => {
      const a = attrs(p[1]);
      return [Number(a.x ?? 0), Number(a.y ?? 0)];
    }) : [];
    cells.push(c);
  }

  const seen = new Set();
  for (const c of cells) {
    if (!c.id) { err('mxCell ไม่มี id'); continue; }
    if (seen.has(c.id)) err(`id ซ้ำ: ${c.id}${c.id === '0' || c.id === '1' ? ' (0 และ 1 สงวนไว้ให้ root/layer ห้ามใช้กับกล่องหรือเส้น)' : ''}`);
    seen.add(c.id);
    if (c.edge === '1' && !c.geo) err(`เส้น ${c.id} ไม่มี <mxGeometry relative="1" as="geometry"/> — draw.io จะวาดเส้นนี้ไม่ได้`);
    if (c.vertex === '1' && byIdHasNoSize(c)) err(`กล่อง "${plain(c.value) || c.id}" ไม่มีขนาด (mxGeometry width/height)`);
  }
  const byId = new Map(cells.map((c) => [c.id, c]));
  const style = (c) => c.style ?? '';
  const isNote = (c) => /(^|;)(text|note|swimlane|group)(;|$)|shape=note|edgeLabel/.test(style(c));
  const vertices = cells.filter((c) => c.vertex === '1' && !isNote(c) && byId.get(c.parent)?.edge !== '1');
  const edges = cells.filter((c) => c.edge === '1');
  const isDecision = (c) => /(^|;)rhombus(;|$)|shape=rhombus/.test(style(c));

  // label ของเส้น: value ของเส้นเอง หรือ cell ลูกแบบ edgeLabel
  const edgeLabel = (e) => {
    const own = plain(e.value);
    if (own) return own;
    const child = cells.find((c) => c.parent === e.id && c.vertex === '1');
    return plain(child?.value);
  };

  const out = new Map(vertices.map((v) => [v.id, []]));
  const inc = new Map(vertices.map((v) => [v.id, 0]));
  for (const e of edges) {
    if (!e.source || !e.target) {
      err(`เส้น ${e.id} ไม่ได้ต่อกับกล่อง (${!e.source ? 'ไม่มีต้นทาง' : 'ไม่มีปลายทาง'}) — ลากปลายเส้นไปติดกล่องใน draw.io`);
      continue;
    }
    if (!byId.has(e.source) || !byId.has(e.target)) {
      err(`เส้น ${e.id} ชี้ไป id ที่ไม่มีอยู่ (${e.source} → ${e.target})`);
      continue;
    }
    out.get(e.source)?.push(e);
    if (inc.has(e.target)) inc.set(e.target, inc.get(e.target) + 1);
  }

  const label = (v) => plain(v.value) || `(ไม่มีข้อความ id=${v.id})`;
  for (const v of vertices) {
    if (!plain(v.value)) warn(`กล่อง id=${v.id} ไม่มีข้อความ`);
    const o = out.get(v.id);
    if (isDecision(v)) {
      if (o.length < 2) err(`ทางแยก "${label(v)}" มีทางออก ${o.length} ทาง — ต้องมีอย่างน้อย 2 (ทั้งใช่และไม่ใช่)`);
      for (const e of o) if (!edgeLabel(e)) err(`ทางออกของทางแยก "${label(v)}" ไม่มีป้าย (ใช่/ไม่ใช่ หรือเงื่อนไข)`);
      const labels = o.map(edgeLabel).filter(Boolean);
      if (new Set(labels).size !== labels.length) err(`ทางแยก "${label(v)}" มีป้ายทางออกซ้ำกัน: ${labels.join(', ')}`);
    }
  }
  const starts = vertices.filter((v) => inc.get(v.id) === 0);
  const ends = vertices.filter((v) => out.get(v.id).length === 0);
  if (vertices.length && starts.length === 0) warn('ไม่มีจุดเริ่ม (ทุกกล่องมีเส้นเข้า) — ถ้าเป็นวงวนทั้งหมด ให้ใส่กล่อง "เริ่ม/เปิดเครื่อง"');
  // จุดเริ่มที่วาดเป็นวงรี (เปิดเครื่อง, เหตุการณ์อย่างกด STOP) ตั้งใจให้ไม่มีเส้นเข้า — กล่องอื่นที่ไม่มีเส้นเข้าคือลืมลาก
  const isTerminal = (v) => /(^|;)(ellipse|terminator)(;|$)|arcSize=50|shape=(terminator|startState)/.test(style(v));
  const orphans = starts.filter((v) => !isTerminal(v));
  if (orphans.length && starts.length > 1) warn(`กล่องที่ไม่มีเส้นเข้า: ${orphans.map(label).join(' | ')} — ลืมลากเส้นเข้าหรือเปล่า (จุดเริ่ม/เหตุการณ์ให้วาดเป็นวงรี)`);
  for (const v of ends) {
    if (!/(^|;)(ellipse|terminator)(;|$)|arcSize=50|shape=(terminator|endState)/.test(style(v)) && !/จบ|end|หยุด|stop/i.test(label(v))) {
      warn(`"${label(v)}" ไม่มีเส้นออก แต่ไม่ได้เป็นกล่องจบ — ลืมลากเส้นต่อหรือเปล่า`);
    }
  }

  // ตำแหน่ง (แนวคิดจาก Agents365-ai/drawio-skill validate.py, MIT): การดูรูปด้วยตาพลาดได้ทั้งสองทาง จึงตรวจจากพิกัด
  // เส้นตรวจเฉพาะเส้นที่มีจุดหัก (<Array as="points">) — เส้นที่ draw.io เดินเองไม่มีพิกัดในไฟล์ จึงไม่เดา
  const parentIds = new Set(cells.map((c) => c.parent));
  const absRect = (c) => {
    if (!c?.geo || c.geo.relative === '1') return null;
    let x = Number(c.geo.x ?? 0), y = Number(c.geo.y ?? 0);
    const w = Number(c.geo.width), h = Number(c.geo.height);
    if (![x, y, w, h].every(Number.isFinite)) return null;
    for (let p = byId.get(c.parent), n = 0; p && p.vertex === '1' && n < 50; p = byId.get(p.parent), n++) {
      x += Number(p.geo?.x ?? 0); y += Number(p.geo?.y ?? 0);
    }
    return { x, y, w, h };
  };
  const leaves = cells
    .filter((c) => c.vertex === '1' && !parentIds.has(c.id) && byId.get(c.parent)?.edge !== '1' && !/edgeLabel/.test(style(c)))
    .map((c) => ({ c, r: absRect(c) })).filter((v) => v.r);
  const name_ = (c) => plain(c.value) || c.id;
  for (let i = 0; i < leaves.length; i++) {
    for (let j = i + 1; j < leaves.length; j++) {
      const a = leaves[i].r, b = leaves[j].r;
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) {
        warn(`"${name_(leaves[i].c)}" กับ "${name_(leaves[j].c)}" วางทับกัน — ขยับให้ห่างกัน`);
      }
    }
  }
  const num = (s, k) => { const m = (s ?? '').match(new RegExp(`(?:^|;)${k}=([\\d.]+)`)); return m ? Number(m[1]) : null; };
  const endPt = (e, end) => {
    const r = absRect(byId.get(e[end]));
    if (!r) return null;
    const fx = num(e.style, end === 'source' ? 'exitX' : 'entryX');
    const fy = num(e.style, end === 'source' ? 'exitY' : 'entryY');
    return [r.x + (fx ?? 0.5) * r.w, r.y + (fy ?? 0.5) * r.h];
  };
  const orient = (a, b, c) => { const v = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); return Math.abs(v) < 1e-9 ? 0 : Math.sign(v); };
  const cross = (p1, p2, p3, p4) => {
    const o = [orient(p1, p2, p3), orient(p1, p2, p4), orient(p3, p4, p1), orient(p3, p4, p2)];
    return o[0] !== o[1] && o[2] !== o[3] && !o.includes(0);
  };
  const inside = (p, r) => p[0] > r.x + 1e-6 && p[0] < r.x + r.w - 1e-6 && p[1] > r.y + 1e-6 && p[1] < r.y + r.h - 1e-6;
  const hits = (pts, r) => {
    const k = [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]];
    const sides = k.map((p, i) => [p, k[(i + 1) % 4]]);
    return pts.slice(1).some((b, i) => inside(pts[i], r) || inside(b, r) || sides.some(([c, d]) => cross(pts[i], b, c, d)));
  };
  // เส้นที่ไม่มีจุดหักแต่ต้นกับปลายอยู่แนวเดียวกัน (นอน/ตั้ง) draw.io วาดเป็นเส้นตรง — รู้ตำแหน่งแน่นอน จึงตรวจด้วย
  const routed = edges.filter((e) => e.source && e.target)
    .map((e) => ({ e, pts: [endPt(e, 'source'), ...e.points, endPt(e, 'target')] }))
    .filter((r) => r.pts.every(Boolean))
    .filter((r) => r.e.points.length || Math.abs(r.pts[0][0] - r.pts[1][0]) < 1 || Math.abs(r.pts[0][1] - r.pts[1][1]) < 1);
  // เส้นที่ใส่ jumpStyle (เส้นกระโดดข้ามตรงจุดตัด) = ตั้งใจให้ตัดและอ่านออก ไม่ต้องเตือน
  const jumps = (e) => /jumpStyle=(arc|gap|sharp|line)/.test(e.style ?? '');
  for (const { e, pts } of routed) {
    for (const { c, r } of leaves) {
      if (c.id !== e.source && c.id !== e.target && hits(pts, r)) warn(`เส้น ${e.id} วิ่งทับกล่อง "${name_(c)}" — เพิ่ม/ย้ายจุดหักให้อ้อม`);
    }
  }
  for (let i = 0; i < routed.length; i++) {
    for (let j = i + 1; j < routed.length; j++) {
      const a = routed[i].pts, b = routed[j].pts;
      if (jumps(routed[i].e) || jumps(routed[j].e)) continue;
      if (a.slice(1).some((p, x) => b.slice(1).some((q, y) => cross(a[x], p, b[y], q)))) {
        warn(`เส้น ${routed[i].e.id} กับ ${routed[j].e.id} ตัดกัน — ย้ายจุดหัก หรือย้ายจุดเข้า (entryX/entryY)`);
      }
    }
  }

  if (outline) {
    console.log(`\n# ${name}  (${vertices.length} กล่อง, ${edges.length} เส้น)`);
    for (const v of vertices) {
      const kind = isDecision(v) ? '◇' : inc.get(v.id) === 0 ? '▶' : out.get(v.id).length === 0 ? '■' : '□';
      console.log(`${kind} [${v.id}] ${label(v)}`);
      for (const e of out.get(v.id)) {
        const t = byId.get(e.target);
        const l = edgeLabel(e);
        console.log(`    ${l ? `--${l}--> ` : '--> '}[${t.id}] ${plain(t.value)}`);
      }
    }
  }
}

console.log(`${errors ? 'FAIL' : 'OK'} ${file}: ${pages.length} หน้า, ${errors} error, ${warnings} warning`);
process.exit(errors ? 1 : 0);
