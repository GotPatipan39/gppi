// ตรวจลิงก์ relative ในไฟล์ .md ทุกไฟล์ที่ git track — ลิงก์เสีย = exit 1 (CI รัน)
// ข้าม: ลิงก์ใน `code`, code block, และ template/ตัวอย่างของ skill ที่ชี้ไฟล์ในโปรเจกต์ของผู้ใช้
import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
const files = execSync('git ls-files "*.md"', { encoding: 'utf8' }).split('\n').filter(Boolean);
// ตัวอย่างใน skill ที่ชี้ไฟล์ของโปรเจกต์ผู้ใช้ (ไม่ใช่ไฟล์ใน gppi) — ข้าม
const skipFile = (f) => /skills\/project-readme\/(template|template-th)\.md$|skills\/project-readme\/examples\/|skills\/project-claude-md\/template\.md$/.test(f);
let bad = 0;
for (const f of files) {
  if (skipFile(f)) continue;
  let inFence = false;
  readFileSync(f, 'utf8').split(/\r?\n/).forEach((line, i) => {
    if (/^\s*```/.test(line)) { inFence = !inFence; return; }
    if (inFence) return;
    for (const m of line.replace(/`[^`]*`/g, "").matchAll(/\]\(([^)\s]+)\)/g)) {
      const t = m[1];
      if (/^([a-z]+:|#|<)/i.test(t) || t.includes('<')) continue;
      const p = resolve(dirname(f), decodeURIComponent(t.replace(/#.*$/, '')));
      if (!existsSync(p)) { bad++; console.log(`${f}:${i + 1} -> ${t}`); }
    }
  });
}
console.log(bad ? `${bad} broken` : 'all links ok');
process.exit(bad ? 1 : 0);
