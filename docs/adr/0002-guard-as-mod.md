# ตัวกันคำสั่งเป็น mod (`tool.check`) ไม่ใช่ PreToolUse hook

ตัวกันคำสั่งเครื่องจักรและคำสั่ง git ที่ย้อนกลับยากอยู่ใน `hooks/gppi.ts` ซึ่งเป็น hooks module (mod) ที่ตอบ `ask` ใน event `tool.check` ไม่ได้เป็น command hook แบบ `PreToolUse`
ทั้งสองแบบบังคับให้ถามทับ `allow` rule ของผู้ใช้ได้เหมือนกัน — เหตุผลที่เลือก mod คือ:
1. mod รันใน Claude Code เอง ไม่ต้องมี Git Bash/node ในเครื่อง — ทีมใช้ทั้ง Windows และ WSL และไม่แน่ใจว่าทุกเครื่องมี runtime ให้ command hook
2. `tool.check` ตัดสินเป็นลำดับสุดท้าย หลัง rule, permission mode และ PreToolUse hook ตัวอื่น ("its answer can replace theirs" — docs/permissions) จึงยังถามได้แม้ hook หรือ mode อื่นปล่อยผ่านแล้ว — ส่วนใน `bypassPermissions` docs ไม่ได้ยืนยันทั้งสองแบบ ยังไม่ได้ทดสอบ
3. test ได้ตรงๆ ด้วย `claude plugin test` (import `isMachineCommand`/`isRiskyGit` มาตรวจ) และตัวกัน git เดิมเป็น mod อยู่แล้ว

แลกกับ: ต้องใช้ Claude Code ≥ 2.1.287 และ API ของ mod ยังใหม่ อาจเปลี่ยนจนตัวกันหยุดทำงานเงียบๆ — CI รัน `claude plugin test` และ `claude plugin validate --strict` เพื่อจับส่วนหนึ่ง

## Consequences
- คำสั่งที่ตัวกันจับได้คือคำสั่ง shell ที่เห็นในบรรทัดเท่านั้น — wrapper script (`./bringup.sh`, `make run`) และโค้ดใน script ที่สั่งเครื่องเอง (pymodbus) หลุด ส่วนนั้นพึ่ง `rules.md` และ `safety-reviewer`
- surface ที่ไม่โหลด plugin (Desktop แบบ WSL session, claude.ai/code) ไม่มีตัวกัน
- ถ้า API ของ mod เปลี่ยนจนใช้ต่อไม่ได้ ย้ายไปเป็น PreToolUse hook ได้ (ได้ `ask` ทับ allow rule เหมือนกัน) แต่ต้องเขียนให้รันได้ทั้ง Git Bash และ PowerShell
