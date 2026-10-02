# Mitsubishi FX5U / FX5UC

สัญลักษณ์: ✅ = ผู้ใช้ยืนยันจากงานจริงแล้ว, ⚠️ = ความรู้ทั่วไป ต้องยืนยันกับคู่มือ/GX Works3 ของเครื่องจริงก่อนใช้

## Modbus TCP (FX5 เป็น server/slave, ใช้ Ethernet port ในตัว)
- ⚠️ เปิดใช้ใน GX Works3: Parameter → Module Parameter → Ethernet Port → ตั้ง "MODBUS/TCP" และ **MODBUS device assignment** (กำหนดว่า coil / holding register ของ Modbus ชี้ไปที่ device ไหนใน PLC เช่น M, Y, D)
- ⚠️ ต้องเขียน parameter ลง PLC แล้ว reset/power cycle ก่อนใช้ได้
- ⚠️ port 502, จำนวน connection พร้อมกันมีจำกัด → master ควรเปิด connection ค้างไว้ตัวเดียว
- **address ที่ใช้ในโค้ดขึ้นกับ device assignment ที่ตั้งไว้ในโปรเจกต์ PLC** — ห้ามสมมติว่า holding 0 = D0 ให้ดูจาก GX Works3 หรือถามผู้ใช้ แล้วบันทึกไว้ใน `CLAUDE.md` ของโปรเจกต์

## Modbus RTU (FX5 เป็น master ผ่าน RS-485 ในตัว)
- ⚠️ ตั้ง protocol ของ RS-485 port เป็น MODBUS_RTU ใน Module Parameter แล้วใช้คำสั่ง **`ADPRW`** อ่าน/เขียนอุปกรณ์ slave
- ✅ ใช้อ่าน encoder JY-ME02-485 จาก PLC ได้ (ดู [jy-me02-485.md](jy-me02-485.md))

## Data type
- D register = 16 bit signed
- ค่า 32 bit (DINT, `DMOV`) เก็บใน D(n) = **low word**, D(n+1) = high word → ฝั่ง master ต้องถอดแบบ **CDAB** (`to_int32_lo_hi` ใน C++, `word_order="little"` ใน pymodbus)
- ค่าติดลบใน D ส่งออกมาเป็น uint16 ≥ 32768 → แปลงเป็น int16 ที่ฝั่ง master

## แนวทางออกแบบ address map เมื่อ master สั่งงาน PLC
- แยกบล็อก **master เขียน** (คำสั่ง) กับ **master อ่าน** (สถานะ) ให้ address ติดกันในแต่ละบล็อก → อ่าน/เขียนครั้งเดียวต่อรอบ
- ใส่ **heartbeat counter** ในบล็อกคำสั่ง: master เพิ่มค่าทุกรอบ, ladder ตรวจว่าค่าไม่เปลี่ยนเกินเวลาที่กำหนด (เช่น 300–500 ms) แล้วสั่งหยุด output เอง — ป้องกันกรณี master ค้าง/สายหลุด
- output ที่เกี่ยวกับความปลอดภัย (enable, E-stop) ให้ ladder เป็นผู้ตัดสิน ไม่ให้ master เขียนตรง
- ใส่ register สถานะ (bitfield ของ output จริง, error code) ให้ master อ่านกลับเพื่อยืนยันผลคำสั่ง

## PWM
- ⚠️ FX5 สั่ง PWM ด้วยคำสั่ง `PWM` (s1 = pulse width, s2 = period) บน output transistor (Y0–Y3)
