# CHANGELOG — modbus

## 1.1.1 — 2026-10-14
จากรีวิว docs/reviews/2026-10-14-skills.md
- `clients/modbus_client.hpp`: เดิมตัด TCP ทุกครั้งที่อ่าน/เขียนไม่สำเร็จ รวมตอนอุปกรณ์ตอบ exception (address ผิด) ทั้งที่ connection ยังดี → reconnect วนทุกรอบ และแยกไม่ออกว่า "address ผิด" หรือ "สายหลุด" — ตอนนี้ exception จากอุปกรณ์ (`EMBXILFUN..EMBXGTAR`) ไม่ตัด + มี `last_was_device_exception()`; error อื่นยังตัดแล้วต่อใหม่เหมือนเดิม — **ยังไม่ได้ compile/ทดสอบ** (ไม่มี compiler ในเครื่องที่แก้)
- `modbus_client.hpp`: เพิ่ม `unit_id` (ค่าเริ่มต้นไม่ตั้ง = พฤติกรรมเดิม) สำหรับ gateway TCP→RTU
- ตัวอย่างที่เขียนค่า: แยก "อ่าน" กับ "เขียน" ใน `python-pymodbus.md` พร้อมคำเตือนว่าเขียนแล้วเครื่องทำงานจริง; `mbpoll` RTU ต้องถามก่อนเปิด serial (ชน master เดิม); ลอง address ±1 ด้วยการอ่านเท่านั้น
- `cpp-libmodbus.md`: ระบุว่า Ubuntu 22.04 ได้ libmodbus 3.1.6 ซึ่งยังไม่ได้ทดสอบ template

## 1.1.0 — 2026-10-12
- เขียน/แก้ฟังก์ชันแปลงค่า (data type, word order, ค่าติดลบ, scale) → สั่งให้โหลด `tdd` ด้วยทันที
- เหตุผล: ทดสอบคำขอ "แปลง register ME231 เป็น float32 แล้วค่าเพี้ยน" ซ้ำ 3 รอบ Claude โหลด `modbus` ทุกรอบ แต่โหลด `tdd` แค่ 2/3 (ตาราง global) และ 0/3 (ตารางที่ส่งผ่าน hook ของ plugin) ทั้งที่พูดถึง `tdd` — คำสั่งที่อยู่ใน skill ที่ถูกโหลดแน่ๆ ไม่ต้องพึ่งการอ่านตารางตอนเริ่ม

## 1.0.0 — 2026-10-02
- เวอร์ชันแรก: พื้นฐาน RTU/TCP, address, word order, exception, debug
- clients: C++ libmodbus (modbus_client.hpp ทดสอบกับ simulator แล้ว), Node-RED, pymodbus 3.15
- tools/modbus_sim.py
- devices: Mitsubishi FX5, Delta ASDA-B3, JY-ME02-485, ME231
