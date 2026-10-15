# CHANGELOG — flowchart

## 1.0.0 — 2026-10-15
- เวอร์ชันแรก (เขียนเอง ไม่ได้มาจากภายนอก): ผู้ใช้สรุป logic เป็น flowchart ใน draw.io ก่อนเขียนโค้ดเสมอ — logic ที่มีลำดับ/เงื่อนไขต้องมี flowchart `docs/flowcharts/<ชื่อ>.drawio` ที่ผู้ใช้ OK ก่อนเขียนโค้ด และแก้ logic ต้องแก้ flowchart ใน commit เดียวกัน (ผู้ใช้เลือกทั้งสามข้อ)
- เนื้อหาที่ logic คุมเครื่องต้องมี: ทุกการรอมี timeout, ทาง fault/STOP, ไม่เดินเองหลัง reset, ค่า hardware จาก CLAUDE.md
- `tools/check_drawio.mjs` (node ไม่มี dependency): ตรวจทางแยกที่ขาดทางออก/ไม่มีป้าย, เส้นลอย, id ซ้ำ, กล่องค้าง; `--outline` แปลง flowchart เป็นข้อความ; อ่านไฟล์บีบอัดและ `.drawio.svg` ได้ — ทดสอบกับไฟล์ที่ตั้งใจทำผิด 5 แบบ (จับได้ทุกแบบ: 4 เป็น error, กล่องไม่มีทางออกเป็น warning) และไฟล์บีบอัดที่ draw.io 31.7 เปิดได้
- ตัวอย่าง `examples/clamp-press-cycle.drawio` ผ่านตัวตรวจ และ export เป็น PNG ด้วย draw.io 31.7 ดูแล้วว่าไม่มีอะไรทับกัน
