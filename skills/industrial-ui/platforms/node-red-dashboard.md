# Node-RED Dashboard

## ใช้ตัวไหน
| package | สถานะ |
|---|---|
| `node-red-dashboard` (ตัวเก่า, `/ui`) | **เลิกพัฒนาแล้ว** (npm ระบุ deprecated) — แก้งานเดิมได้ แต่ไม่ใช้กับงานใหม่ |
| `@flowfuse/node-red-dashboard` (Dashboard 2.0, `/dashboard`) | ใช้กับงานใหม่ (ตรวจล่าสุด v1.33.0, 2026-10) |
| `node-red-contrib-uibuilder` | เมื่อต้องการเขียน HTML/JS/React เองเต็มรูปแบบแต่ยังอยู่ใน Node-RED |

ถ้าโปรเจกต์ใช้ตัวเก่าอยู่ ห้ามเปลี่ยนเป็นตัวใหม่เองโดยไม่ถาม (node และ flow ใช้ร่วมกันไม่ได้)

## โครงสร้าง Dashboard 2.0
- **Base** (ตั้งค่ารวม) → **Page** (หน้า) → **Group** (กล่อง) → **Widget**
- แต่ละ Page ตั้ง layout ได้ (grid / fixed / notebook) — touch panel ใช้ grid ขนาดคงที่ตามความละเอียดจอ
- Theme: ตั้งสีให้ตรงกับ tokens.css (พื้นเทา, สี alarm ตามระดับ) ที่ Theme config ไม่ตั้งสีทีละ widget
- `ui-template` ใช้ Vue (ไม่ใช่ Angular แบบตัวเก่า) — โค้ด template ของตัวเก่า copy มาใช้ตรงๆ ไม่ได้

## รูปแบบ flow
```
[Modbus poll] → [แปลงค่า + timestamp] → flow.set(...)          ← แยกการอ่านออกจาก UI
                                     → [ui-text / ui-gauge]    ← แสดงผล
[inject ทุก 1 s] → [ตรวจ stale จาก timestamp] → [ui-text สถานะ]
[ui-button] → [ยืนยัน (ui-notification แบบ confirm)] → [เขียน Modbus] → [อ่านกลับ] → [แสดงผล ✓/✗]
```
- ปุ่มสั่งงานต้องผ่านขั้นยืนยันและอ่านกลับ (ดู SKILL.md ข้อ 4)
- **confirm ต้องไปที่หน้าจอของคนที่กดเท่านั้น** — `ui-notification` ส่งไปหน้าจอเดียวเมื่อ `msg._client` ยังอยู่ ถ้า node ระหว่างทางทำ `_client` หาย confirm จะขึ้นทุกหน้าจอที่เปิดอยู่ และคนอื่นกดยืนยันคำสั่งแทนได้ — ตรวจทุก node ระหว่างปุ่มกับ confirm ว่าส่ง `msg` ต่อทั้งก้อน (https://dashboard.flowfuse.com/nodes/widgets/ui-notification.html)
- hold-to-run: `ui-button` มีตัวเลือก "Enable pointerdown/pointerup event" แล้ว (`msg._event`) แต่ **event ปล่อยปุ่มหายได้เมื่อ connection หลุด** → ฝั่งเครื่องยังต้องหยุดเองจาก heartbeat timeout เสมอ; ใช้ pointer event ของ `ui-button` + heartbeat หรือ `ui-template` ที่เขียนเอง หรือปุ่มกายภาพ (https://dashboard.flowfuse.com/nodes/widgets/ui-button.html)
- widget ที่ให้ผู้ใช้ป้อนตัวเลข: ตั้ง min/max/step ที่ widget **และ** ตรวจซ้ำใน function node ก่อนเขียนลงอุปกรณ์

## Local เท่านั้น
- Dashboard 2.0 รวมไฟล์ไว้ใน package แล้ว ไม่ต้องใช้ internet ตอนรัน
- font ภาษาไทย: วางไฟล์ใน `httpStatic` ของ Node-RED แล้วอ้างใน Theme/CSS ห้ามใช้ Google Fonts
- ตั้ง `adminAuth` ใน `settings.js` เพื่อไม่ให้คนที่เปิดหน้า dashboard ได้ เข้าไปแก้ flow ได้ด้วย
