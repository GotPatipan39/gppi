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

let errors = 0;
let warnings = 0;
for (const { name, body } of pages) {
  const err = (msg) => { errors++; console.log(`ERROR [${name}] ${msg}`); };
  const warn = (msg) => { warnings++; console.log(`WARN  [${name}] ${msg}`); };

  // เก็บ mxCell ทุกตัว — ตัวที่ห่อด้วย <object>/<UserObject> ใช้ id/label จากตัวห่อ
  const cells = [];
  let wrapper = null;
  for (const m of body.matchAll(/<(\/?)(\w+)\b([^>]*?)(\/?)>/g)) {
    const [, close, tag, a, selfClose] = m;
    if (tag === 'object' || tag === 'UserObject') {
      wrapper = close ? null : attrs(a);
      continue;
    }
    if (tag !== 'mxCell' || close) continue;
    const c = attrs(a);
    if (wrapper) {
      c.id = wrapper.id;
      c.value = wrapper.label ?? c.value;
    }
    cells.push(c);
    if (selfClose) { /* nothing */ }
  }

  const seen = new Set();
  for (const c of cells) {
    if (!c.id) { err('mxCell ไม่มี id'); continue; }
    if (seen.has(c.id)) err(`id ซ้ำ: ${c.id}`);
    seen.add(c.id);
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
