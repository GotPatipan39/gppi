# CHANGELOG — industrial-ui

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
