# CHANGELOG — modbus

## 1.1.2 — 2026-10-14
ข้อมูลล้าสมัย (จากรีวิว กลุ่ม 2)
- pymodbus: datastore แบบเดิม deprecated ตั้งแต่ 3.13 (SimData) — `tools/modbus_sim.py` บอกวิธี pin ถ้ารุ่นใหม่รันไม่ได้
- `devices/delta-asda-b3.md`: B3 มี P3-04 = communication timeout (ยัง ⚠️ ยืนยันหน่วย); ค่า P2-30 แบบไม่บันทึก EEPROM หายเมื่อปิดไฟ
- `devices/me231.md`: ตัดสูตร `1000 + 2k` ที่ชวนให้คำนวณ address เองทั้งที่ยังไม่รู้ลำดับค่า

## 1.1.1 — 2026-10-14
จากรีวิว docs/reviews/2026-10-14-skills.md
- `clients/modbus_client.hpp`: เดิมตัด TCP ทุกครั้งที่อ่าน/เขียนไม่สำเร็จ รวมตอนอุปกรณ์ตอบ exception (address ผิด) ทั้งที่ connection ยังดี → reconnect วนทุกรอบ และแยกไม่ออกว่า "address ผิด" หรือ "สายหลุด" — ตอนนี้ exception จากอุปกรณ์ (`EMBXILFUN..EMBXGTAR`) ไม่ตัด + มี `last_was_device_exception()`; error อื่นยังตัดแล้วต่อใหม่เหมือนเดิม — ทดสอบกับ libmodbus 3.1.6 + Modbus TCP server จำลองบน localhost (ไม่ใช่ PLC จริง): exception ไม่ตัดสาย, server เห็นการเชื่อมต่อครั้งเดียว (แก้โค้ดก่อนเขียน test — ไม่ได้เห็น test แดงกับโค้ดเดิม)
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
