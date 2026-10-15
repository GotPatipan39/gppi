#!/usr/bin/env node
// ตรวจว่า CLAUDE.md ยังตรงกับโปรเจกต์ (ไม่ต้องติดตั้งอะไรเพิ่ม — ใช้ node ที่ gppi ต้องมีอยู่แล้ว)
//   node check_claude_md.mjs [path/to/CLAUDE.md]     (ค่าเริ่มต้น: ./CLAUDE.md)
// ตรวจ: pointer แบบ `ไฟล์`: `KEY` — ไฟล์มีจริงและมี KEY อยู่ข้างใน, ลิงก์/path ในไฟล์ชี้ไปของที่มีจริง,
//       ความยาว, TODO ที่ค้าง, ข้อความที่หน้าตาเหมือนรหัสผ่าน — error = exit 1
// แนวคิด "ตรวจว่ายังตรงกับโค้ด (currency)" จาก anthropics/claude-plugins-official claude-md-improver (Apache-2.0)
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const file = process.argv[2] ?? 'CLAUDE.md';
if (!existsSync(file)) {
  console.error(`ERROR ไม่มีไฟล์ ${file}`);
  process.exit(1);
}
const root = dirname(resolve(file));
const lines = readFileSync(file, 'utf8').split(/\r?\n/);
let errors = 0;
let warnings = 0;
const err = (n, msg) => { errors++; console.log(`ERROR ${file}:${n} ${msg}`); };
const warn = (n, msg) => { warnings++; console.log(`WARN  ${file}:${n} ${msg}`); };

// path ที่ตรวจได้: ไม่มีช่องว่าง/placeholder/glob/URL และหน้าตาเป็นไฟล์หรือโฟลเดอร์ (มี / หรือนามสกุล)
const isPathLike = (s) =>
  !/[\s<>*{}|$]/.test(s) && !/^[a-z]+:\/\//i.test(s) && !s.startsWith('-') && !s.startsWith('@') &&
  (/\//.test(s) || /^\.?[\w.-]+\.(md|ya?ml|json|jsonc|js|cjs|mjs|ts|py|cpp|hpp|h|xml|launch\.py|drawio|toml|ini|cfg|conf|service|env|example|txt|sh|ps1)$/i.test(s));
const exists = (p) => existsSync(resolve(root, p.replace(/^\.\//, '').replace(/#.*$/, '')));
const keyIn = (p, key) => {
  const full = resolve(root, p);
  if (!existsSync(full) || statSync(full).isDirectory()) return false;
  const text = readFileSync(full, 'utf8');
  const has = (k) => new RegExp(`(^|[^\\w])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\w]|$)`, 'm').test(text);
  // key แบบซ้อนของ yaml/json (`camera.index`) — ทุกส่วนต้องมีอยู่ในไฟล์ (ตรวจคร่าวๆ ไม่ parse yaml)
  return has(key) || (key.includes('.') && key.split('.').every(has));
};

let inFence = false;
let inComment = false;
lines.forEach((line, i) => {
  const n = i + 1;
  if (/^\s*```/.test(line)) { inFence = !inFence; return; }
  if (/<!--/.test(line)) inComment = true;
  if (inComment) { if (/-->/.test(line)) inComment = false; return; }
  if (inFence) return;

  // `ไฟล์`: `KEY`, `KEY2`
  const ptr = line.matchAll(/`([^`]+)`\s*:\s*((?:`[^`]+`\s*,?\s*)+)/g);
  const pointed = new Set();
  for (const m of ptr) {
    const p = m[1];
    if (!isPathLike(p)) continue;
    pointed.add(p);
    if (!exists(p)) { err(n, `ไม่มีไฟล์ ${p} (ชี้ค่า ${m[2].trim()}) — ไฟล์ถูกย้าย/ลบ หรือ CLAUDE.md เก่า`); continue; }
    for (const k of m[2].matchAll(/`([^`]+)`/g)) {
      const key = k[1].replace(/=.*$/, '').trim();
      if (!/^[\w.-]+$/.test(key)) continue;
      if (!keyIn(p, key)) err(n, `ไม่เจอ ${key} ใน ${p} — ค่าถูกเปลี่ยนชื่อ/ลบ หรือ CLAUDE.md เก่า`);
    }
  }
  // path อื่นใน backtick และลิงก์ markdown
  for (const m of line.matchAll(/`([^`]+)`/g)) {
    const p = m[1];
    if (pointed.has(p) || !isPathLike(p)) continue;
    if (!exists(p)) warn(n, `ไม่มี ${p} ในโปรเจกต์ — ถ้าเป็นชื่อไฟล์ ให้แก้ path; ถ้าไม่ใช่ (ชื่อ topic/ตัวอย่าง) ไม่ต้องสนใจ`);
  }
  for (const m of line.matchAll(/\]\(([^)\s]+)\)/g)) {
    const p = m[1];
    if (/^([a-z]+:|#)/i.test(p)) continue;
    if (!exists(p)) err(n, `ลิงก์เสีย: ${p}`);
  }
  // @import ของ Claude Code
  for (const m of line.matchAll(/(?:^|\s)@([\w./-]+\.\w+)/g)) {
    if (!exists(m[1])) err(n, `import @${m[1]} ชี้ไปไฟล์ที่ไม่มี`);
  }
  if (/\b(TODO|FIXME|XXX)\b/.test(line)) warn(n, 'มี TODO ค้าง — ทำให้เสร็จ หรือย้ายไปไว้ใน ❓ ถ้าเป็นสิ่งที่ยังไม่รู้');
  if (/(password|passwd|secret|token|api[_-]?key)\s*[:=]\s*\S{4,}/i.test(line)) {
    err(n, 'ข้อความหน้าตาเหมือนรหัสผ่าน/token — CLAUDE.md ถูก commit และส่งเข้าแชททุกครั้ง ห้ามมีค่าลับ');
  }
});

if (lines.length > 150) warn(lines.length, `ยาว ${lines.length} บรรทัด — CLAUDE.md โหลดทุก session; แยกส่วนที่ไม่ต้องใช้ทุกครั้งไป docs/ แล้วลิงก์`);
const unknown = lines.filter((l) => l.includes('❓')).length;
console.log(`${errors ? 'FAIL' : 'OK'} ${file}: ${errors} error, ${warnings} warning, ❓ ${unknown} ข้อ`);
process.exit(errors ? 1 : 0);
