# CHANGELOG — modbus

## 1.1.0 — 2026-10-12
- เขียน/แก้ฟังก์ชันแปลงค่า (data type, word order, ค่าติดลบ, scale) → สั่งให้โหลด `tdd` ด้วยทันที
- เหตุผล: ทดสอบคำขอ "แปลง register ME231 เป็น float32 แล้วค่าเพี้ยน" ซ้ำ 3 รอบ Claude โหลด `modbus` ทุกรอบ แต่โหลด `tdd` แค่ 2/3 (ตาราง global) และ 0/3 (ตารางที่ส่งผ่าน hook ของ plugin) ทั้งที่พูดถึง `tdd` — คำสั่งที่อยู่ใน skill ที่ถูกโหลดแน่ๆ ไม่ต้องพึ่งการอ่านตารางตอนเริ่ม

## 1.0.0 — 2026-10-02
- เวอร์ชันแรก: พื้นฐาน RTU/TCP, address, word order, exception, debug
- clients: C++ libmodbus (modbus_client.hpp ทดสอบกับ simulator แล้ว), Node-RED, pymodbus 3.15
- tools/modbus_sim.py
- devices: Mitsubishi FX5, Delta ASDA-B3, JY-ME02-485, ME231
