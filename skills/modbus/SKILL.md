---
name: modbus
description: ใช้เมื่อทำงานกับ Modbus RTU (RS-485) หรือ Modbus TCP — อ่าน/เขียน register, แปลง data type (int16, int32, float32, word order), ตั้งค่า slave ID/baud, debug การสื่อสาร, เขียน client ด้วย C++ libmodbus, Node-RED หรือ Python pymodbus และงานกับอุปกรณ์ เช่น PLC Mitsubishi FX5, servo Delta ASDA-B3, encoder JY-ME02-485, smart meter ME231
---

# Modbus RTU / TCP

> เวอร์ชัน 1.1.2 — ดู [CHANGELOG.md](CHANGELOG.md)

ข้อมูลเฉพาะโปรเจกต์ (address map, slave ID ที่ตั้งไว้, ผังระบบ) อยู่ใน `CLAUDE.md` ของโปรเจกต์นั้น ให้อ่านก่อนเสมอ ถ้าขัดกับไฟล์ใน skill นี้ ให้ยึดของโปรเจกต์

**เขียนหรือแก้ฟังก์ชันแปลงค่า** (data type, word order, ค่าติดลบ, scale, หน่วย) → **โหลด skill `tdd` ด้วยตอนนี้เลย** ก่อนแก้โค้ด — บั๊กแปลงค่าไม่มี error มีแค่ตัวเลขผิด จึงต้องมี test ที่เห็นแดงก่อนแก้ ใช้ค่าที่คาดหวังจาก datasheet/ค่าที่อ่านได้จากอุปกรณ์จริง และไม่ต่ออุปกรณ์ใน test — skill นี้บอกว่าค่าที่ถูกคืออะไร `tdd` บอกวิธีพิสูจน์ว่าแก้ถูก

## เปิดอ่านตามงาน
| งาน | ไฟล์ |
|---|---|
| เขียน client ด้วย C++ (รวมถึงใน ROS2 node) | [clients/cpp-libmodbus.md](clients/cpp-libmodbus.md) + [clients/modbus_client.hpp](clients/modbus_client.hpp) |
| Node-RED (`node-red-contrib-modbus`) | [clients/node-red.md](clients/node-red.md) |
| Python / สคริปต์ทดสอบ | [clients/python-pymodbus.md](clients/python-pymodbus.md) |
| ทดสอบโดยไม่ต่ออุปกรณ์จริง | [tools/modbus_sim.py](tools/modbus_sim.py) |
| PLC Mitsubishi FX5U / FX5UC | [devices/mitsubishi-fx5.md](devices/mitsubishi-fx5.md) |
| Servo Delta ASDA-B3 | [devices/delta-asda-b3.md](devices/delta-asda-b3.md) |
| Encoder WitMotion JY-ME02-485 | [devices/jy-me02-485.md](devices/jy-me02-485.md) |
| Smart meter ME231 | [devices/me231.md](devices/me231.md) |

อุปกรณ์ที่ยังไม่มีไฟล์: ขอ datasheet/register map จากผู้ใช้ ห้ามเดา address และเสนอให้สร้างไฟล์ใน `devices/` เพิ่ม

## กฎที่ต้องทำตามเสมอ
1. **ห้ามเดา address, slave ID, scaling หรือ data type** ถ้าไม่มีใน datasheet หรือไฟล์โปรเจกต์ ให้ถาม
2. **ระวังการเขียน:** ก่อนเขียน register ใหม่ที่ยังไม่เคยใช้ ให้อ่านค่าเดิมก่อน และยืนยันกับผู้ใช้ว่าเป็น register ที่ถูกต้อง การเขียนผิดตัวกับ servo/PLC อาจทำให้เครื่องขยับหรือค่า parameter เสีย
3. **เขียนสำเร็จไม่ได้แปลว่าอุปกรณ์ทำตาม:** ถ้าเป็นคำสั่งที่สำคัญ (หยุด, เปิด/ปิด) ให้อ่านสถานะกลับมายืนยัน
4. **อุปกรณ์ที่สั่งให้เครื่องขยับต้องมี watchdog ฝั่งอุปกรณ์** (เช่น heartbeat register ที่ PLC ตรวจ หรือ communication timeout ของ servo) เพราะถ้า master ค้างหรือสายหลุด master จะส่งคำสั่งหยุดไม่ได้
5. **ระวังเขียน parameter ถี่ๆ ลง EEPROM:** อุปกรณ์หลายตัว (เช่น servo) บันทึก parameter ลง EEPROM ทุกครั้งที่เขียน ถ้าจะเขียนซ้ำบ่อย ให้ดูวิธีปิดการบันทึกในไฟล์อุปกรณ์
6. **รายงานผลให้ชัด** ว่าทดสอบกับ simulator หรืออุปกรณ์จริง

## Address: 0-based vs เลข 4xxxx
| ในเอกสาร | ชนิด | Function code (อ่าน / เขียน) | address ที่ใส่ในโค้ด |
|---|---|---|---|
| 0xxxx (00001–) | Coil | FC01 / FC05, FC15 | เลขในเอกสาร − 1 |
| 1xxxx (10001–) | Discrete input | FC02 / – | เลขในเอกสาร − 10001 |
| 3xxxx (30001–) | Input register | FC04 / – | เลขในเอกสาร − 30001 |
| 4xxxx (40001–) | Holding register | FC03 / FC06, FC16 | เลขในเอกสาร − 40001 |

- library ทุกตัว (libmodbus, pymodbus, node-red-contrib-modbus) ใช้ address แบบ **0-based**
- ถ้า datasheet เขียนเป็น hex หรือเลขธรรมดา (เช่น `0x0011`, `1000`) ส่วนใหญ่เป็น 0-based อยู่แล้ว แต่ถ้าอ่านได้ค่าที่ดูผิดและคลาดไป 1 ช่อง ให้ลอง ±1 **ด้วยการอ่านเท่านั้น** — ห้ามลองด้วยการเขียน (address ข้างเคียงอาจเป็นคำสั่งอื่นของเครื่อง)
- ข้อมูล 32-bit ใช้ 2 register ติดกัน

## Data type และ word order
1 register = 16 bit (2 byte) ภายใน register เป็น big-endian เสมอ แต่ลำดับ **word** ของค่า 32-bit แล้วแต่ยี่ห้อ

| ชื่อเรียก | ลำดับ | พบใน |
|---|---|---|
| ABCD (big-endian) | high word ก่อน | ME231, อุปกรณ์ส่วนใหญ่ |
| CDAB (word swap) | low word ก่อน | Mitsubishi FX5 (D, D+1), Delta ASDA |
| BADC / DCBA | สลับ byte | พบน้อย ถ้าค่าเพี้ยนมากให้ลอง |

- ค่าติดลบ (int16): register ที่อ่านได้ ≥ 32768 หมายถึงติดลบ → `value - 65536`
- ค่าทศนิยมส่วนใหญ่เก็บเป็นจำนวนเต็ม × scale (เช่น ×10, ×100) — scale ต้องมาจาก datasheet
- วิธีหา word order เมื่อไม่แน่ใจ: ให้อุปกรณ์แสดงค่าที่รู้อยู่แล้ว (เช่น แรงดัน ~230 V) แล้วถอดทั้ง ABCD และ CDAB ดูว่าอันไหนได้ค่าที่สมเหตุสมผล

## Modbus RTU (RS-485)
- **master ได้ตัวเดียวต่อบัส** slave ID ต้องไม่ซ้ำกัน (1–247)
- ทุกอุปกรณ์บนบัสต้องตั้ง baud, parity, stop bit ตรงกัน (เช่น 9600 8N1 หรือ 19200 8E1)
- เดินสายแบบ daisy chain ไม่ใช่ star, ใส่ termination 120 Ω ที่ปลายสองด้าน, ต่อ GND ร่วมถ้าระยะไกลหรือมีสัญญาณรบกวน
- สลับ A/B แล้วไม่เสียหาย แค่ไม่มี response — ถ้าไม่ตอบเลยให้ลองสลับก่อน
- ส่ง request ทีละอัน รอ response หรือ timeout ก่อนส่งอันต่อไป ห้ามยิงซ้อนกัน
- รอบ poll: ประมาณ 10–50 ms ต่อ request ที่ 9600 baud แล้วแต่จำนวน register → ถ้าบัสมีหลายอุปกรณ์ให้คำนวณรอบรวมก่อนตั้ง rate
- Linux: พอร์ตเป็น `/dev/ttyUSB*` ต้องอยู่กลุ่ม `dialout`; ใช้ udev ตั้งชื่อคงที่ / Windows: `COMx`; WSL: ต้องส่ง USB เข้าไปด้วย `usbipd`

## Modbus TCP
- port มาตรฐาน 502 (Linux ต้องเป็น root ถึงจะ listen ที่ 502 ได้ — เป็นเรื่องของฝั่ง server/simulator เท่านั้น)
- unit ID (slave ID) ส่วนใหญ่ไม่สนใจ แต่ gateway TCP→RTU ใช้ unit ID เลือกอุปกรณ์ปลายทาง
- อุปกรณ์หลายตัวรับ connection พร้อมกันได้จำกัด → เปิด connection ค้างไว้ใช้ซ้ำ ห้ามเปิด-ปิดทุกครั้งที่อ่าน
- ตั้ง response timeout สั้น (100–300 ms ใน LAN) และ reconnect แบบมีช่วงพักเมื่อหลุด

## อ่านเป็นบล็อก
วาง register ที่ต้องอ่านทุกรอบไว้ติดกัน แล้วอ่านครั้งเดียว (FC03 ได้สูงสุด 125 register ต่อ request) ดีกว่าอ่านทีละตัวหลาย request ทั้งเร็วกว่าและค่าทุกตัวมาจากจังหวะเดียวกัน — ถ้าออกแบบ address map เองได้ (เช่นใน PLC) ให้แยกบล็อก "master เขียน" กับ "master อ่าน"

## Exception code
| code | ความหมาย | สาเหตุที่พบบ่อย |
|---|---|---|
| 01 | Illegal function | อุปกรณ์ไม่รองรับ FC นั้น (เช่นใช้ FC04 กับอุปกรณ์ที่มีแต่ holding) |
| 02 | Illegal data address | address ผิด / คลาด 1 / อ่านเกินช่วง / ยังไม่ได้ map ใน PLC |
| 03 | Illegal data value | จำนวน register เกิน หรือค่าที่เขียนอยู่นอกช่วง |
| 04 | Device failure | อุปกรณ์มีปัญหาภายใน |
| (timeout) | ไม่มี response | slave ID/baud/parity ผิด, สาย A/B, ไม่มี termination, IP/port ผิด, firewall |

## เครื่องมือ debug
- `mbpoll` (Linux, `sudo apt install mbpoll`):
  ```bash
  mbpoll -m tcp -p 502 -a 1 -r 1 -c 10 192.168.1.10          # อ่าน holding 10 ตัว (-r เป็น 1-based!)
  mbpoll -m rtu -b 9600 -P none -a 80 -r 18 -c 1 /dev/ttyUSB0  # RTU
  ```
  ระวัง: `mbpoll -r` นับ register เริ่มที่ 1 ส่วนในโค้ดเริ่มที่ 0 (ใช้ `-0` ถ้าอยากให้เริ่มที่ 0)
  - **RTU: ถามผู้ใช้ก่อนเปิด serial port ทุกครั้ง แม้แค่อ่าน** — ถ้ามี master ตัวอื่น (PLC, ROS2 node, Node-RED) ใช้ bus อยู่ คำสั่งจะชนกันบนสาย RS-485 และ port อาจถูกจองอยู่ (ตัวกันของ gppi ถามก่อนรันอยู่แล้ว แต่ Claude ต้องบอกเหตุผลให้ผู้ใช้ตัดสินใจได้)
  - `mbpoll` ที่มีค่าต่อท้าย (เช่น `... /dev/ttyUSB0 123`) คือ **การเขียน** — ทำเฉพาะเมื่อผู้ใช้สั่งค่านั้นชัดเจน
- Windows: Modbus Poll, QModMaster
- ไม่มีอุปกรณ์: `python3 tools/modbus_sim.py --port 5020 --hr 0=100 1=-90`
