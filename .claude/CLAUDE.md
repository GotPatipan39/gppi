# gppi — คำสั่งสำหรับ Claude ที่แก้ repo นี้

repo นี้คือ plugin ของทีม (skill, กฎ, ตัวกันคำสั่ง) ไม่ใช่โปรเจกต์คุมเครื่อง — ไฟล์นี้ใช้ตอนแก้ gppi เท่านั้น plugin ไม่โหลดไฟล์นี้ในเครื่องทีม (ทีมได้ `rules.md` ผ่าน SessionStart hook)
วิธีดูแลทั้งหมดอยู่ที่ [docs/dev/MAINTAINING.md](../docs/dev/MAINTAINING.md) — อ่านก่อนแก้ skill, ตัวกัน หรือออกเวอร์ชัน

## ก่อน commit
```bash
claude plugin validate . --strict
claude plugin test .          # test ของตัวกัน รวม test จับเวลา — regex ช้า = hook timeout = ปล่อยผ่านเงียบๆ
node dev/check-links.mjs
```
- แก้ skill → ขึ้น `> เวอร์ชัน` ใน SKILL.md + `CHANGELOG.md` ของ skill + ตาราง skill ใน [README.md](../README.md)
- แก้โค้ดใน skill ที่คุม hardware → `bash dev/test-skill-code.sh` ใน WSL
- แก้ `description` ของ skill หรือ [rules.md](../rules.md) → eval ตาม MAINTAINING (เสียเงินทุกครั้ง ถามผู้ใช้ก่อน, ห้ามรันบนเครื่องที่ต่อ PLC/serial)
- แก้ตัวกัน ([hooks/gppi.ts](../hooks/gppi.ts)) → อ่าน [docs/GUARD.md](../docs/GUARD.md) และ ADR ใน [docs/dev/adr/](../docs/dev/adr/) ก่อน; ตอบได้แค่ `ask` ห้ามตอบ `allow`

## ห้าม
- แก้เนื้อหา skill ที่มี `LICENSE` ของตัวเอง (มาจากภายนอก) — อัปเดตด้วยการ copy จากต้นทางทั้งไฟล์ แล้วบันทึก commit ต้นทางใน README และ [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)
- ใส่ MCP, monitor หรืออะไรที่แตะ bus ไว้ใน plugin (เหตุผลใน [mcp/README.md](../mcp/README.md))
- push หรือออกเวอร์ชันโดยผู้ใช้ไม่ได้สั่ง — ทีมได้ของใหม่เมื่อเลขใน [.claude-plugin/plugin.json](../.claude-plugin/plugin.json) เปลี่ยนเท่านั้น
- ตั้งชื่อโฟลเดอร์เป็นภาษาไทย

## เครื่อง dev นี้ (Windows)
- ไม่มี `gh` และ `python` — ใช้ node; งาน Linux ใช้ `wsl.exe -- bash -s < script`
- ไฟล์ในงานเป็น LF แต่ git บน Windows อาจแปลง — script ที่แก้ไฟล์ให้จับข้อความแบบไม่สน `\r`
- อย่าใส่ `'` ใน `node -e '...'` — เขียน script ลงไฟล์ใน temp แล้วรัน
