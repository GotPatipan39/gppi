# conveyor-sorter — สำหรับ Claude

<!-- ตัวอย่างโปรเจกต์สมมติ แสดงระดับรายละเอียดที่ต้องการ — ไม่ใช่ค่าของเครื่องจริงใดๆ -->

คัดกล่องบนสายพานด้วยกล้อง แล้วสั่ง PLC ดันกล่องเข้าราง — Node.js API + Python (OpenCV) + PLC ผ่าน Modbus TCP — ภาพรวมสำหรับคน: [README.md](README.md)

## เครื่องที่รัน
| | dev | หน้างาน (runtime) |
|---|---|---|
| เครื่อง/OS | Windows 11 + WSL | mini PC **Windows 11** (ไม่ใช่ Ubuntu ตาม rules.md) |
| วิธีรัน | `npm run dev` ใน `api/` | pm2 จาก `ecosystem.config.cjs` |
| ชื่อ process | | `sorter-api`, `sorter-vision` |

- หน้างานไม่มี internet — dependency ใหม่ต้องเตรียม offline ก่อน ✅ 2026-10-01

## อุปกรณ์และการเชื่อมต่อ
| อุปกรณ์ | รุ่น | เชื่อมต่อ | ค่าอยู่ที่ | สถานะ |
|---|---|---|---|---|
| PLC | Mitsubishi FX5U | Modbus TCP | `api/.env.example`: `PLC_IP`, `PLC_PORT` | ✅ 2026-10-01 |
| กล้อง | USB UVC | USB | `vision/config.yaml`: `camera.index` | ⚠️ |

- comm timeout ฝั่ง PLC: ladder ตรวจ heartbeat D200 ทุก 1 s ถ้าไม่เปลี่ยนเกิน 3 s หยุดสายพาน ✅ 2026-10-01
- timeout/retry ฝั่งเรา: `api/.env.example`: `PLC_TIMEOUT_MS`, `PLC_RECONNECTION_DELAY` ⚠️
- word order ของค่า 32-bit (D210–D211): ❓

## Register map
แผง REGISTER OWNERSHIP ใน [docs/flow/sort-handshake.drawio](docs/flow/sort-handshake.drawio) คือฉบับหลัก — สรุปที่ต้องรู้ก่อนแก้โค้ด:

| register | ใครเขียน | ใครอ่าน | ความหมาย / ค่า | สถานะ |
|---|---|---|---|---|
| D100 | PLC | เรา | 1 = กล่องถึงจุดถ่ายภาพ; **PLC เป็นคนเคลียร์** | ✅ 2026-10-01 |
| D102 | เรา | PLC | ผลคัด: 1 = รางซ้าย, 2 = รางขวา, 99 = ปล่อยผ่าน | ✅ 2026-10-01 |
| D200 | เรา | PLC | heartbeat: เพิ่มค่าทุก 500 ms | ✅ 2026-10-01 |
| D4 | เรา | PLC | คำสั่ง: 1 start / 2 stop / 3 reset | ⚠️ |

- D100 เคยถูกเราเขียน 0 หลังอ่าน แล้วชนกับ ladder ที่เขียนพร้อมกัน → ตอนนี้ PLC เคลียร์เองเท่านั้น ห้ามกลับไปเขียน (ดูกล่อง "ทำไม" ใน flowchart)

## ความปลอดภัย — อ่านก่อนแก้โค้ดที่สั่งเครื่อง
- **สิ่งที่ทำให้เครื่องขยับ**: เขียน D4 = 1 (สายพานเดิน), เขียน D102 (กระบอกดันกล่อง), endpoint `POST /api/command`, ปุ่ม START/RESET บน UI ⚠️
- **หยุดเครื่อง**: STOP บน UI เขียน D4 = 2 (หยุดแบบ ladder ควบคุม); E-stop ตัดไฟ output ทาง hardware ไม่ผ่านโปรแกรม ✅ 2026-10-01
- **ห้าม**: เขียน D102 ตอน D100 ไม่ใช่ 1 — กระบอกจะดันกล่องที่ไม่ได้ถ่ายภาพ
- หลังไฟดับ/reset: ladder ไม่เดินเองจนกว่าจะได้ D4 = 1 ใหม่ ⚠️

## คำสั่ง
| ทำอะไร | คำสั่ง | Claude รันเองได้? |
|---|---|---|
| test API | `cd api && npm test` | ได้ |
| test vision | `cd vision && python -m pytest` | ได้ |
| รัน API บนเครื่อง dev กับ PLC จำลอง | `npm run dev:sim` | ถาม |
| restart บนเครื่องหน้างาน | `pm2 restart sorter-api` | **ไม่** — ผู้ใช้ทำ |

## เอกสาร
- flowchart: `docs/flow/*.drawio` (skill `flowchart`)
- การตัดสินใจ: `docs/adr/`

## ❓ ยังไม่รู้
- word order ของ D210–D211 (นับชิ้นงานรวม 32-bit)
- `vision/config.yaml` `camera.index` บนเครื่องหน้างานเป็น 0 หรือ 1
