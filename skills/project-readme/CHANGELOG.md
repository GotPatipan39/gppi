# CHANGELOG — project-readme

## 1.0.1 — 2026-10-14
- description: เพิ่ม trigger ให้ตรงกับตาราง "ใช้ skill ตามงาน" ใน rules.md — Claude เลือก skill จาก description ถ้าไม่มีคำเหล่านี้ skill จะไม่ถูกโหลดในงานที่ตารางสั่งไว้ (จากรีวิว กลุ่ม 3): แก้โค้ด/config ที่ทำให้สิ่งที่ README อธิบายเปลี่ยน

## 1.0.0 — 2026-10-02
- เวอร์ชันแรก: หลักการเขียน README สำหรับทีมบน GitLab — ข้อเท็จจริงต้องตรงกับโค้ด, อธิบาย "ทำไม" กับสิ่งที่ดูแปลก, ความปลอดภัยมาก่อน, ค่ามาจากไหนจริง, ติดตั้งแบบ offline, รูปแบบ, admonition บน GitLab
- ต้นแบบ: README ของ borunte-control ที่ผู้ใช้เขียนเอง (examples/)
- template.md โครงเริ่มต้นที่เลือกหัวข้อตามโปรเจกต์
- ส่วนที่ได้แนวคิดจาก github/awesome-copilot `create-readme` (MIT): กระชับ, ไม่ซ้ำกับ LICENSE/CHANGELOG, ใช้ admonition — ไม่ใช้ส่วนที่ต้องโหลด README ตัวอย่างจาก internet
