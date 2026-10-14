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
| แก้แล้ว (`modbus` 1.1.0 สั่งโหลด `tdd` เมื่อแก้ฟังก์ชันแปลงค่า + ตัวอย่าง `modbus` + `tdd` ในตาราง global) รัน c01 ซ้ำ 3 รอบ | เดิม **3/3**, plugin **3/3** |
| commit ผ่าน `git-commit` (แก้ชื่อเป็น `mskills:safety-reviewer`) | เรียกตัวตรวจ, ได้ 🔴 ครบ 5 จุด, ไม่ commit |
| ขอตรวจความปลอดภัยโดยไม่บอกชื่อ agent | Claude เลือก `mskills:safety-reviewer` เอง |
| ขออนุมัติตอน skill เปิดไฟล์ประกอบ (`modbus/devices/me231.md`) | ถูกขออนุมัติ **ทั้งแบบเดิมและ plugin** (3/3 ทั้งคู่) — ไม่ใช่ปัญหาของ plugin |

### ติดตั้งจาก marketplace จริง (branch `plugin-trial`, plugin ทดลอง `mtrial`)
| เรื่อง | ผล |
|---|---|
| `marketplace add GotPatipan39/mskills#plugin-trial` (repo private) บน Windows | ได้ — ต้องตั้ง `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` เพราะเครื่องนี้ใช้ git ผ่าน HTTPS; ใช้ credential ที่ git มีอยู่ ไม่ต้องใส่ token เพิ่ม |
| ไม่ใส่ `version` ใน `plugin.json` | เวอร์ชัน = commit (`9c443419724c`) — ตรงกับ docs; ที่ skill plugin-dev บอกว่า "ถือเป็น 0.1.0" เก่าแล้ว |
| skill + hook จาก plugin ที่ติดตั้ง | ทำงาน (cache อยู่ที่ `~/.claude/plugins/cache/<marketplace>/<plugin>/<commit>`) |
| push commit ใหม่ แล้วเปิด session ใหม่ (ไม่เปิด auto-update) | ยังได้ของเก่า — ตามคาด |
| เปิด `autoUpdate: true` ใน `extraKnownMarketplaces` แล้วเปิด session ใหม่ทันที (`-p` 3 ครั้ง + แชทใน VS Code 1 ครั้ง) | **ยังได้ของเก่า** — marketplace ไม่ได้ดึงจาก GitHub เลยในช่วงไม่กี่นาที; รอบการเช็คยังไม่รู้ |
| `claude plugin marketplace update` + `claude plugin update` | ได้ของใหม่ใน session ถัดไป ("Restart to apply changes") |

ค่าใช้จ่ายรวมทุกรอบประมาณ $14

บทเรียน: skill ความรู้ (`modbus`, `opencv`) ถูกโหลดแน่นอนกว่า skill วิธีทำงาน (`tdd`) เมื่องานต้องใช้คู่กัน — ใส่คำสั่ง "โหลด `tdd` ด้วย" ไว้ใน skill ความรู้ตรงๆ ได้ผลกว่าพึ่งตารางอย่างเดียว

## ถ้าจะย้าย ต้องทำ
- ส่ง `install/global-CLAUDE.md` เป็น `rules.md` ผ่าน hook `SessionStart` (`cat "${CLAUDE_PLUGIN_ROOT}/rules.md"`, quote path, ใส่ `timeout`) แล้ว**ลบบล็อกเดิมใน `~/.claude/CLAUDE.md`** ไม่ให้มีกฎ 2 ชุด
- แก้ `git-commit` ให้เรียก `mskills:safety-reviewer`
- ลบ skill/agent ของ mskills ที่ installer เคย copy ไว้ใน `~/.claude/` ออก**ทุกเครื่อง** และให้ installer เลิก copy
- permissions (`ask` ก่อน `git push` ฯลฯ) — plugin ส่งไม่ได้: ใส่ `.claude/settings.json` ของแต่ละโปรเจกต์ หรือ script ตั้งเครื่องครั้งเดียว
- ป้องกันกฎความปลอดภัยหายเงียบ (hook ไม่รัน) และแก้ผิดแล้วไปถึงทุกเครื่อง (เครื่องหน้างานติดตาม branch/tag ที่ทดสอบแล้ว)

## ยังไม่ได้ทดสอบ
- auto-update เช็คบ่อยแค่ไหน (ไม่ได้ผลภายในไม่กี่นาที) — ถ้าช้าเกินไป ทางสำรองคือสั่ง `claude plugin marketplace update` + `plugin update` เอง (ยังสั้นกว่า `git pull` + install แต่ไม่ใช่อัตโนมัติ)
- hook บน Ubuntu
- repo เดียวเป็นทั้ง marketplace และ plugin

## ไม่เกี่ยวกับ plugin แต่เจอระหว่างทดสอบ
- skill ที่ต้องเปิดไฟล์ประกอบ (`references/`, `devices/`) ถูกขออนุมัติทุกครั้ง เพราะไฟล์อยู่นอกโปรเจกต์ — ถ้าใช้จริงแล้วรำคาญ พิจารณาเพิ่มกฎ allow ให้ Read ใน `~/.claude/skills/**` ใน `install/permissions.json`

ชุดทดสอบ (script + log) อยู่ใน scratchpad ของ session นี้ ไม่ได้เก็บเข้า repo
