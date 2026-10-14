# ตัวกันคำสั่งเป็น PreToolUse hook (node) ซ้อนกับ mod

ตัวกันคำสั่งเครื่องจักร/git ทำงานสองชั้นที่ใช้ logic ชุดเดียวกันใน `hooks/gppi.ts`:
1. **PreToolUse command hook** — `node hooks/pretooluse.ts` ตอบ `permissionDecision: "ask"`
2. **mod** (`tool.check`) — ตอบ `ask` เหมือนเดิม

เหตุผล: ทดสอบ 2026-10-14 (Claude Code 2.1.296, CLI) พบว่าใน **auto mode** — ซึ่งเป็นค่าเริ่มต้นของ CLI บนเครื่องที่ทดสอบโดยไม่ได้ตั้งเอง — `ask` ของ mod ถูก classifier อนุมัติแทนคน (`reasonType: "classifier"`) แล้ว `ros2 topic pub` รันโดยไม่ถาม
docs รับประกันเฉพาะ hook: "A hook's `"ask"` also forces a permission prompt in auto mode: the classifier can still deny the tool call, but it can't approve the call silently" (code.claude.com/docs/en/hooks) — ส่วน mod ไม่มีประโยคแบบนี้ และไม่มี field ให้ mod รู้ว่าอยู่ใน mode ไหน

**hook รันไม่ได้ = บล็อก (fail-closed)**: คำสั่งใน `hooks.json` ต่อท้ายด้วย `|| { echo ... >&2; exit 2; }` — node ไม่มี/เก่า/ไม่อยู่ใน PATH ของ hook/import ล้ม จะบล็อกคำสั่ง Bash/PowerShell ทุกตัวพร้อมบอกวิธีแก้ เพราะ hook ที่ error ปกติจะ **ไม่บล็อก** และใน auto mode คำสั่งเครื่องจักรจะรันโดยไม่มีใครถาม — ตัวกันที่พังเงียบๆ อันตรายกว่าตัวกันที่ทำให้งานหยุด
ข้อยกเว้นที่ยัง fail-open: (1) Windows ที่ไม่มี Git Bash — hook รันด้วย PowerShell ซึ่ง `|| { ...; exit 2; }` ไม่ทำงาน (5.1 ไม่รู้จัก `||`; 7 มอง `{ }` เป็น scriptblock) — README ให้ติดตั้ง Git for Windows ทุกเครื่อง (2) hook เกิน timeout (30s) ถูก kill ก่อนถึง `||`

ที่ยังเก็บ mod ไว้: กรณี fail-open ข้างบน mod ยังกันได้ในโหมดปกติ และ mod ถามทับ allow rule ได้ (ทดสอบแล้วใน VS Code)

แลกกับ: ต้องมี node ≥ 22.18 ทุกเครื่องที่ใช้ Claude Code รวมฝั่ง WSL (รัน `.ts` ได้เองโดยไม่ต้อง build) — ทีมใช้ Node-RED/pm2 อยู่แล้ว; เครื่องที่ตั้งไม่ครบจะใช้ shell ไม่ได้จนกว่าจะแก้

## Considered Options
- **mod อย่างเดียว** (ADR-0002): ไม่ต้องมี runtime แต่ไม่กันใน auto mode
- **mod `tool.call` + `$.ui.ask`**: ถามคนเองโดยไม่ต้องมี runtime แต่ docs บอกว่า mod วาด UI ใน VS Code chat panel ไม่ได้ — surface หลักของทีมจะเหลือแค่ deny
- **hook เขียนด้วย bash/PowerShell**: ไม่ต้องมี node แต่ต้องเขียน logic สองชุดให้ตรงกัน และ Windows ที่ไม่มี Git Bash ใช้ bash ไม่ได้

## Consequences
- ยังไม่ได้ทดสอบ `bypassPermissions` — docs ไม่ได้บอกว่า hook `ask` มีผลในโหมดนั้น
- ไม่จับ wrapper script และโค้ดที่สั่งเครื่องจากข้างใน (เหมือนเดิม) — พึ่ง `rules.md` และ `safety-reviewer`
