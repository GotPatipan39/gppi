# Web (HTML / JS / React)

เริ่มจาก [../templates/hmi_template.html](../templates/hmi_template.html) (ไฟล์เดียว ไม่พึ่ง internet มีข้อมูลจำลองในตัว) และใช้สีจาก [../templates/tokens.css](../templates/tokens.css)

## เลือกวิธี
| ขนาดงาน | แนะนำ |
|---|---|
| หน้าเดียว, ไม่กี่ค่า | HTML + vanilla JS ไฟล์เดียว (เหมือน template) |
| หลายหน้า, state เยอะ, ทำต่อเนื่อง | React + Vite (build เป็นไฟล์ static แล้ว serve ใน LAN) |
| อยู่ใน Node-RED อยู่แล้ว | ดู node-red-dashboard.md ก่อน |

## รับ-ส่งข้อมูลกับเครื่อง
- **ค่าที่เปลี่ยนต่อเนื่อง**: WebSocket (server push) ไม่ใช่ polling REST ถี่ๆ
- **คำสั่ง**: ส่งเป็นข้อความที่มี id แล้วรอ ack จาก server พร้อม timeout:
  ```json
  {"type":"cmd","id":"c-1729","name":"start"}       // browser → server
  {"type":"ack","id":"c-1729","ok":true}            // server → browser (หลังอุปกรณ์ยืนยัน)
  ```
- ทุกข้อความค่าจากเครื่องมี timestamp ฝั่ง server → browser ใช้ตรวจ stale
- WebSocket หลุด: แสดง "ขาดการเชื่อมต่อ", ทำทุกค่าเป็น stale, ปิดปุ่มสั่งงาน, reconnect แบบเว้นระยะเพิ่มขึ้น (1, 2, 4… สูงสุด 10 s)
- **jog แบบ hold-to-run**: ส่ง `jog_start` แล้วส่ง heartbeat ทุก 100–200 ms ระหว่างกด; server/อุปกรณ์ต้องหยุดเองถ้า heartbeat หายเกิน ~500 ms; ฝั่ง browser หยุดเมื่อ `pointerup`, `pointercancel`, `pointerleave`, `blur`, `visibilitychange` (hidden), WebSocket ปิด
- ROS2: ดู [ros2-bridge.md](ros2-bridge.md) — ห้ามให้ browser ส่ง `/cmd_vel` ตรงโดยไม่ผ่าน bridge ที่มี watchdog

## Local เท่านั้น
- ไม่ใช้ `<script src="https://...">`, Google Fonts, icon CDN — copy ไฟล์มาไว้ในโปรเจกต์
- React: ติดตั้งผ่าน npm ตอน dev แล้ว build เป็น static; เครื่องหน้างานไม่ต้องมี internet
- icon: ใช้ SVG inline หรือ icon set ที่ copy มาเก็บไว้
- serve ด้วย server ในเครื่อง (backend เดียวกับ WebSocket, nginx, หรือ Node-RED `httpStatic`)

## Touch panel / kiosk
- `touch-action: manipulation` (ตัด delay ของ double-tap zoom), ปิด text selection บนปุ่ม (`user-select: none`)
- ใช้ pointer events (`pointerdown/up`) ไม่ใช้ `click` อย่างเดียวสำหรับปุ่ม hold-to-run
- ปิด context menu จากการกดค้าง (`contextmenu` → `preventDefault`) บนปุ่ม
- Chrome kiosk: `chromium --kiosk --noerrdialogs --disable-pinch --overscroll-history-navigation=0 http://localhost:1880/ui`
- ถ้าจอดับ/หลุด ให้หน้าเว็บโหลดใหม่ได้เองโดยไม่ต้องมีคนกด

## ทดสอบ
- ทดสอบด้วยข้อมูลจำลองก่อน (template มี simulator ในตัว) แล้วค่อยต่อของจริง
- ตัดการเชื่อมต่อระหว่างใช้งาน → ตรวจตาม checklist ใน SKILL.md
- DevTools → Network → ไม่มี request ออกนอก LAN
