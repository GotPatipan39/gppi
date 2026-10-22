# CHANGELOG — spec-tickets

## 1.0.0 — 2026-10-22
- เวอร์ชันแรก: สรุปบทสนทนาเป็น spec (`docs/specs/`) และแตกเป็น ticket แบบ vertical slice พร้อมลำดับการรอ (`docs/tickets/<spec>/`) — เก็บเป็นไฟล์ในโปรเจกต์ (ผู้ใช้เลือก) ไม่สร้าง issue บน GitLab
- เพิ่มสำหรับงานเครื่องจักร: หัวข้อความปลอดภัย (อะไรทำให้ขยับ, ทางหยุด, หลัง reset), ค่า hardware ที่ยัง ❓, flowchart ที่ต้องมี, การทดสอบแยกระดับพร้อมคนรัน; ticket ที่ทำให้เครื่องขยับจบที่ simulator ก่อน การลองกับเครื่องจริงเป็น ticket แยกที่ผู้ใช้รัน และ Claude ไม่ทำเครื่องหมาย done แทนผู้ใช้
- ดัดแปลงจาก mattpocock/skills `to-spec` และ `to-tickets` @ 5beb35b (MIT): template ของ spec, seam ที่จะ test, vertical slice + blocking edges, ถามผู้ใช้ก่อนเผยแพร่, prefactor ก่อน, expand–contract สำหรับการเปลี่ยนที่กระทบทั้ง codebase — ไม่เอา: `/setup-matt-pocock-skills` และ triage label (เราไม่มี), การเผยแพร่ไป issue tracker, `disable-model-invocation` (ผู้ใช้สั่งเป็นภาษาธรรมดา); `retro` ไม่รับตอนนี้ (ซ้ำกับการจดสิ่งที่เรียนรู้ของ `project-claude-md`)
