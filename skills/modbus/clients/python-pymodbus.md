# Python ด้วย pymodbus

เหมาะกับสคริปต์ทดสอบ, ตรวจ register, ทำ simulator — ไม่แนะนำสำหรับ loop ควบคุมที่ต้องการเวลาแน่นอน

## ติดตั้ง
```bash
pip install "pymodbus>=3.10,<4"      # ตัวอย่างข้างล่างทดสอบกับ 3.15
```
pymodbus เปลี่ยน API บ่อย (เช่น `slave=` เปลี่ยนเป็น `device_id=` ใน 3.10, datastore แบบเดิมถูก deprecate ตั้งแต่ 3.13 แทนด้วย SimData — ล่าสุดที่ตรวจ 3.16.1, 2026-10) — ถ้าโค้ดใช้ไม่ได้ ให้เช็กเวอร์ชันก่อน `python3 -c "import pymodbus; print(pymodbus.__version__)"`

## อ่าน (ทดสอบแล้ว)
IP, port, address และ device ID ในตัวอย่างเป็นค่าสมมติ — ใช้ค่าจาก CLAUDE.md/คู่มือของโปรเจกต์ ห้ามเดา
```python
from pymodbus.client import ModbusTcpClient          # RTU: ModbusSerialClient(port="/dev/ttyUSB0", baudrate=9600)

c = ModbusTcpClient("192.168.1.10", port=502, timeout=0.5)
assert c.connect()

rr = c.read_holding_registers(1000, count=2, device_id=1)   # address แบบ 0-based
if rr.isError():
    print(rr)
else:
    v = c.convert_from_registers(rr.registers, c.DATATYPE.FLOAT32)                   # ABCD
    n = c.convert_from_registers(rr.registers, c.DATATYPE.INT32, word_order="little") # CDAB (Mitsubishi)
c.close()
```

## เขียน (ทดสอบแล้ว)
> ⚠ **คำสั่งเขียนสั่งเครื่องได้จริง** (`write_coil(0, True)` อาจเปิด output/มอเตอร์) — Claude รันเองได้เฉพาะเมื่อผู้ใช้สั่งให้เขียนค่านั้นชัดเจนในข้อความนั้น และต้องรู้ว่า address นั้นคืออะไรบนเครื่องจริง (ตาม rules.md)
```python
c.write_registers(10, c.convert_to_registers(-90, c.DATATYPE.INT16), device_id=1)
c.write_coil(0, True, device_id=1)
```
- `DATATYPE` มี `INT16, UINT16, INT32, UINT32, FLOAT32, INT64, FLOAT64, STRING, BITS`
- `word_order="big"` = ABCD (ค่าเริ่มต้น), `"little"` = CDAB

## หา word order / scaling ของอุปกรณ์ที่ไม่รู้จัก
```python
rr = c.read_holding_registers(addr, count=2, device_id=uid)
for wo in ("big", "little"):
    for t in (c.DATATYPE.FLOAT32, c.DATATYPE.INT32, c.DATATYPE.UINT32):
        print(wo, t.name, c.convert_from_registers(rr.registers, t, word_order=wo))
```
เทียบกับค่าที่อุปกรณ์แสดงบนหน้าจอ แล้วเลือกตัวที่ตรง
