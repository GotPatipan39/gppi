# ทดลองแปลง mskills เป็น Claude Code plugin

ทดสอบเมื่อ 2026-10-12 บน Windows 11 กับ Claude Code 2.1.296 (`claude.exe` ที่มากับ VS Code extension) ด้วย `claude -p --plugin-dir`
**ยังไม่ได้ย้ายจริง** — repo และ skill ที่ติดตั้งไม่ได้เปลี่ยน; ทุกรอบที่ต้องตัดของเดิมออกได้คืนด้วย `install-skills.ps1 -All` และเช็คว่า `~/.claude/CLAUDE.md` เหมือนเดิมทุกไบต์

## ทำไมถึงพิจารณา
ใช้ skill หลายเครื่อง (Windows + Ubuntu ทุกเครื่องมี internet) และแก้ skill บ่อย — ตอนนี้ทุกครั้งที่แก้ต้อง `git pull` + install ทีละเครื่อง; plugin ที่เปิด auto-update ไว้จะได้ของใหม่เอง

## ผลทดสอบ
| เรื่อง | ผล |
|---|---|
| `claude plugin validate` | ผ่าน |
| ชื่อ skill ใน plugin | แสดงเป็น `mskills:<ชื่อ>` แต่ตาราง/คำสั่งที่ใช้ชื่อสั้น (`tdd`) ยังเรียกถูก |
| ชื่อ agent ใน plugin | **ต้องใช้ชื่อเต็ม** `mskills:safety-reviewer` — ชื่อสั้นได้ error `Agent type ... not found` |
| skill ชื่อซ้ำ (plugin + `~/.claude/skills`) | ตัวใน `~/.claude/skills` ชนะ **โดยไม่มีคำเตือน** |
| hook `SessionStart` ส่งตาราง + กฎ (แทน CLAUDE.md) | ทำงานบน Windows รวม path ที่มีช่องว่าง; กลุ่มควบคุมที่ไม่มี hook เลือก skill ไม่ได้เลย, มี hook เลือกถูก + ทำตามกฎทั่วไป 4/4 |
| hook หลัง `/compact` | รันซ้ำ (`SessionStart:compact`) และกฎยังอยู่หลัง compact |
| ตารางจริง 10 คำขอ ผ่าน hook | 8/10 ตรงกับแบบเดิม (แบบเดิม 10/10); ต่างกันที่ `tdd` — ดูแถวถัดไป |
| `tdd` รันซ้ำ 3 รอบ | c07 (state machine + interlock): เดิม 3/3, plugin 3/3 — c01 (แปลง register ME231): เดิม **2/3**, plugin **0/3** (plugin พูดถึง `tdd` ทุกรอบแต่ไม่โหลด) |
| commit ผ่าน `git-commit` (แก้ชื่อเป็น `mskills:safety-reviewer`) | เรียกตัวตรวจ, ได้ 🔴 ครบ 5 จุด, ไม่ commit |
| ขอตรวจความปลอดภัยโดยไม่บอกชื่อ agent | Claude เลือก `mskills:safety-reviewer` เอง |
| ขออนุมัติตอน skill เปิดไฟล์ประกอบ (`modbus/devices/me231.md`) | ถูกขออนุมัติ **ทั้งแบบเดิมและ plugin** (3/3 ทั้งคู่) — ไม่ใช่ปัญหาของ plugin |

ค่าใช้จ่ายรวมทุกรอบประมาณ $12

## ถ้าจะย้าย ต้องทำ
- ส่ง `config/global-CLAUDE.md` เป็น `rules.md` ผ่าน hook `SessionStart` (`cat "${CLAUDE_PLUGIN_ROOT}/rules.md"`, quote path, ใส่ `timeout`) แล้ว**ลบบล็อกเดิมใน `~/.claude/CLAUDE.md`** ไม่ให้มีกฎ 2 ชุด
- แก้ `git-commit` ให้เรียก `mskills:safety-reviewer`
- ลบ skill/agent ของ mskills ที่ installer เคย copy ไว้ใน `~/.claude/` ออก**ทุกเครื่อง** และให้ installer เลิก copy
- permissions (`ask` ก่อน `git push` ฯลฯ) — plugin ส่งไม่ได้: ใส่ `.claude/settings.json` ของแต่ละโปรเจกต์ หรือ script ตั้งเครื่องครั้งเดียว
- ป้องกันกฎความปลอดภัยหายเงียบ (hook ไม่รัน) และแก้ผิดแล้วไปถึงทุกเครื่อง (เครื่องหน้างานติดตาม branch/tag ที่ทดสอบแล้ว)

## ยังไม่ได้ทดสอบ
- `tdd` ใน c01 หายเพราะ plugin จริงหรือไม่ (3 รอบยังน้อย) และแก้ได้ไหม เช่น เขียนแถว `tdd` ในตารางให้ชัดขึ้นว่าใช้คู่กับ skill อื่น
- ติดตั้งจาก marketplace จริง (repo private) และ auto-update — รวมถึงข้อขัดแย้งว่าไม่ใส่ `version` แล้ว "ติดตาม commit" (docs) หรือ "ถือเป็น 0.1.0" (skill plugin-dev)
- hook บน Ubuntu
- repo เดียวเป็นทั้ง marketplace และ plugin

## ไม่เกี่ยวกับ plugin แต่เจอระหว่างทดสอบ
- skill ที่ต้องเปิดไฟล์ประกอบ (`references/`, `devices/`) ถูกขออนุมัติทุกครั้ง เพราะไฟล์อยู่นอกโปรเจกต์ — ถ้าใช้จริงแล้วรำคาญ พิจารณาเพิ่มกฎ allow ให้ Read ใน `~/.claude/skills/**` ใน `config/permissions.json`

ชุดทดสอบ (script + log) อยู่ใน scratchpad ของ session นี้ ไม่ได้เก็บเข้า repo
