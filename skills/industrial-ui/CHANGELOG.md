# CHANGELOG — industrial-ui

## 1.2.2 — 2026-10-14
ข้อมูลล้าสมัย (จากรีวิว docs/reviews/2026-10-14-skills.md กลุ่ม 2)
- `platforms/ros2-bridge.md`: rosbridge **มี** glob allowlist (`topics_glob` ฯลฯ) — ที่ไม่มีคือการยืนยันตัวตนผู้ใช้ (rosauth ไม่มีใน ROS 2) เดิมเขียนว่าจำกัด topic ไม่ได้
- `platforms/node-red-dashboard.md`: Dashboard 2.0 v1.33.0; `ui-button` มี pointerdown/pointerup แล้ว แต่ event ปล่อยปุ่มหายได้ตอนหลุด → heartbeat ยังจำเป็น; confirm ด้วย `ui-notification` ต้องคง `msg._client` ไม่งั้นขึ้นทุกหน้าจอ
- `platforms/web.md`: kiosk URL `/ui` → `/dashboard` (Dashboard 2.0)

## 1.2.1 — 2026-10-14
แก้จุดที่ทำให้ operator เข้าใจสถานะเครื่องผิด (จากรีวิว docs/reviews/2026-10-14-skills.md)
- `templates/hmi_template.html`:
  - ป้าย "PLC เชื่อมต่อ" เดิมมาจากสถานะ WebSocket — server หลุดจาก PLC แต่ socket ยังต่อ ป้ายก็ยังขึ้นว่าเชื่อมต่อ → ตอนนี้แยก browser↔server กับ server↔PLC (server ส่ง `links.plc` มาเอง) และบอกว่าขาดที่ link ไหน
  - mode / สถานะเครื่อง / สถานะอุปกรณ์ ไม่เคยตรวจความสด — ข้อมูลหยุดแต่ socket ยังต่อ = ขึ้น RUNNING ค้าง → ตอนนี้ใช้ timestamp ของ status แบบเดียวกับค่าตัวเลข และปิดปุ่ม mode/jog เมื่อ stale
  - ปุ่ม STOP เดิมถูก disable ระหว่างรอ ack (สูงสุด 2 s) → STOP ไม่ผ่าน `runButton` แล้ว กดซ้ำได้ทุกเมื่อ ล้มเหลวแล้วบอกให้ใช้ E-stop ที่ตัวเครื่อง
  - simulator เพิ่มปุ่ม "server หลุดจาก PLC" และ "ข้อมูลหยุด (socket ยังต่อ)"
- SKILL.md: สถานะการเชื่อมต่อต้องแยกทีละ link, stale ใช้กับ mode/สถานะด้วย, STOP ห้ามถูกล็อก, interlock บนจอเป็นแค่ความสะดวก PLC ต้องตรวจซ้ำ; checklist ทดสอบ 3 แบบของการขาดการเชื่อมต่อ

## 1.2.0 — 2026-10-02
- เพิ่ม platforms/ros2-bridge.md ดัดแปลงจาก robotics-agent-skills `ros2-web-integration` (Apache-2.0):
  - โครงสร้าง bridge ที่เข้ากับ ROS_LOCALHOST_ONLY=1, เลือก rosbridge vs bridge เขียนเอง, allowlist, rate limit, ack พร้อมสถานะ, ภาพกล้อง, threading ของ rclpy + FastAPI, ความปลอดภัยใน LAN
  - แก้จากต้นฉบับ: watchdog teleop publish ศูนย์ครั้งเดียวแล้วหยุด (ต้นฉบับ publish ศูนย์ตลอด), publish ผ่าน /cmd_vel_web เข้า twist_mux, clamp จาก parameter, teleop ทีละ client, ตั้ง parameter ที่ node ปลายทางจริงพร้อมตรวจช่วงและอ่านกลับ (ต้นฉบับแก้แค่ parameter ของ bridge), HTTPS แบบไม่มี internet
- web.md ชี้ไป ros2-bridge.md

## 1.1.0 — 2026-10-02
- ดัดแปลงแนวคิดจาก anthropics/skills `frontend-design` (Apache-2.0) เฉพาะส่วนที่เข้ากับหน้าจอใช้งาน:
  - ข้อความบนหน้าจอ: เรียกตามที่ผู้ใช้เข้าใจ, ปุ่มบอกสิ่งที่จะเกิด, ใช้คำเดิมตลอด flow, error บอกวิธีแก้, หน้าว่างบอกสิ่งที่ต้องทำต่อ
  - motion เฉพาะดึงความสนใจ/ตอบสนองการกด, โครงสร้างทางสายตาต้องมีความหมาย
  - ขั้นตอน: วางแผน → ตรวจกับโจทย์ → เขียน → screenshot ตรวจเอง
  - checklist เพิ่ม keyboard focus, คำสม่ำเสมอ, reduced motion
- ไม่รับแนวคิด "ดีไซน์แปลกใหม่ทุกงาน / กล้าเสี่ยง" เพราะขัดกับ HMI ที่ต้องสม่ำเสมอ — ระบุขอบเขตให้ใช้ `frontend-design` กับหน้าเว็บนำเสนอแทน
- hmi_template: ปุ่มยืนยันใน dialog ใช้คำของคำสั่ง ("เริ่มเดิน", "เปลี่ยนเป็น MANUAL") แทน "ยืนยัน" — ทดสอบซ้ำผ่านทั้งหมด

## 1.0.0 — 2026-10-02
- เวอร์ชันแรก: หลักออกแบบ (สีแบบ ISA-101, ขนาดสำหรับ touch/ถุงมือ, stale data, คำสั่งที่ปลอดภัย, local เท่านั้น, ภาษา)
- patterns: HMI, dashboard, หน้า config
- platforms: Web, Node-RED Dashboard 2.0, Grafana
- templates: tokens.css (สีผ่าน contrast ≥ 4.5:1 ทุกคู่), hmi_template.html
- hmi_template.html ทดสอบด้วย Playwright (Chromium): START ยืนยัน 2 ขั้น, STOP, interlock, MODE, JOG hold-to-run (ปล่อยแล้วหยุด), alarm + ack, หลุดการเชื่อมต่อ (stale + ปิดปุ่ม), dark mode, จอมือถือ 390 px ไม่ล้น, ไม่มี request ออกนอกเครื่อง, ไม่มี JS error
