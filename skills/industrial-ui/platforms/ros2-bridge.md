# เชื่อม Web UI กับ ROS2

ใช้ร่วมกับ [web.md](web.md) และ skill `ros2-humble-cpp`
แนวคิดดัดแปลงจาก [robotics-agent-skills / ros2-web-integration](https://github.com/arpitg1304/robotics-agent-skills) (Apache-2.0) — ปรับให้เข้ากับ local เท่านั้น และแก้จุดที่ไม่ปลอดภัยในตัวอย่างต้นฉบับ

## โครงสร้าง (เข้ากับ ROS_LOCALHOST_ONLY=1)
```
[browser / touch panel / tablet] ──HTTP + WebSocket (LAN เครื่องจักร)──> [web bridge] ──DDS localhost──> [ROS2 nodes]
                                                                          อยู่บน mini PC เครื่องเดียวกับ nodes
```
- **web bridge เป็นตัวเดียวที่ทั้งเปิดรับจาก LAN และคุยกับ ROS2** → ROS2 ยังตั้ง `ROS_LOCALHOST_ONLY=1` ได้ ไม่ต้องเปิด DDS ออก LAN
- bridge แปลงและกรองข้อมูล ไม่ส่ง DDS ดิบออกไป
- ถ้ามี LAN ออฟฟิศด้วย: bridge รับเฉพาะ interface ของ LAN เครื่องจักร (bind IP นั้น ไม่ใช่ `0.0.0.0`) หรือใช้ firewall

## เลือกแบบไหน
| | rosbridge_suite | bridge เขียนเอง (เช่น FastAPI + rclpy) |
|---|---|---|
| ใช้เมื่อ | dev, ทดสอบ, ดูข้อมูลด้วย Foxglove | ใช้งานจริงกับเครื่องที่ขยับได้ |
| เริ่มได้เร็ว | ✅ launch แล้วใช้ได้เลย | ต้องเขียนเอง |
| จำกัด topic ที่เปิดให้ | ❌ ค่าเริ่มต้นเปิดทุก topic/service — ใครก็ได้ใน LAN publish `/cmd_vel` ได้ | ✅ allowlist |
| watchdog / ack / rate limit | ❌ ต้องทำเองที่ฝั่ง robot | ✅ ทำที่ bridge |
| สิทธิ์ผู้ใช้ | จำกัดมาก | ทำได้เต็มที่ |

**ห้ามใช้ rosbridge แบบค่าเริ่มต้นกับเครื่องที่ขยับได้ในการใช้งานจริง** — ถ้าจำเป็นต้องใช้ ให้ bind เฉพาะ localhost แล้วมี proxy ที่จำกัด topic อยู่หน้า หรือใช้ระหว่าง dev เท่านั้น

## กฎของ bridge
1. **allowlist ใน config** — ระบุ topic/service ที่เปิดให้ web พร้อมทิศทาง (อ่าน/เขียน) ห้ามให้ browser ขอ subscribe/publish topic ไหนก็ได้
2. **rate limit ต่อ client** — ส่งค่าไป browser ไม่เกินที่หน้าจอใช้ (สถานะ ~5–10 Hz ก็พอ) แม้ topic จริงจะ 50–100 Hz; client ขอช้ากว่านี้ได้ แต่ขอเร็วกว่าเพดานไม่ได้
3. **ส่งเฉพาะค่าล่าสุด** (queue 1) — browser ช้าหรือเน็ตกระตุก ให้ทิ้งค่าเก่า ไม่สะสมคิว
4. **ทุกข้อความมี timestamp จาก bridge** เพื่อให้หน้าจอตรวจ stale ได้
5. **ติดตามการเชื่อมต่อ** — client หลุดต้องเอาออกจากรายการและยกเลิก stream ของ client นั้น
6. **ภาพกล้อง**: ใช้ `CompressedImage` (JPEG) แล้วส่งเป็น binary WebSocket หรือ MJPEG ห้ามส่ง `Image` ดิบหรือ base64 ใน JSON (ใหญ่ขึ้น ~33% และกิน CPU)

## คำสั่งจาก web → robot
### คำสั่งทั่วไป (start, stop, mode, reset)
ใช้รูปแบบเดียวกับ [web.md](web.md) และเพิ่มสถานะระหว่างทางสำหรับงานที่ใช้เวลา:
```json
{"type":"cmd","id":"c-17","name":"goto","x":1.0,"y":2.0}          // browser → bridge
{"type":"ack","id":"c-17","status":"accepted"}                    // รับคำสั่งแล้ว
{"type":"ack","id":"c-17","status":"in_progress","progress":0.45} // (ถ้าเป็น action)
{"type":"ack","id":"c-17","status":"completed"}                   // หรือ "rejected" / "failed" + "reason"
```
- bridge ตอบ `accepted` หลังจาก node ปลายทางรับคำสั่งแล้วเท่านั้น (เช่น service ตอบ, action goal accepted)
- งานที่ใช้เวลา → ใช้ ROS2 action ไม่ใช่ service

### Teleop / jog จาก browser
```
[browser hold-to-run] ──WS──> [bridge] ──/cmd_vel_web──> [twist_mux] ──/cmd_vel──> controller
                                                ↑ priority ต่ำกว่าจอยกายภาพ
```
- bridge publish ไปที่ **topic ของ web เอง** (เช่น `/cmd_vel_web`) เข้า `twist_mux` ไม่ publish `/cmd_vel` ตรง
- **watchdog ใน bridge: ไม่ได้รับคำสั่ง/heartbeat เกิน 500 ms → publish ศูนย์ 1 ครั้งแล้วหยุด publish** — ห้าม publish ศูนย์ต่อเนื่องตลอดเวลาที่ไม่มีคนใช้ (ตัวอย่างต้นฉบับทำแบบนั้น ซึ่งจะไปแย่งคำสั่งจากแหล่งอื่น หรือทำให้ twist_mux คิดว่า web ยังคุมอยู่) — การหยุดจริงพึ่ง timeout ของ twist_mux และ watchdog ของ controller/PLC อยู่แล้ว
- client หลุด (WebSocket close) → ทำเหมือน watchdog timeout
- **clamp ด้วยค่าจาก parameter** ของ bridge (เช่น `web_max_linear`) ซึ่งควรต่ำกว่าเพดานของ controller ไม่ hard-code
- ให้คุมได้ทีละ 1 client: client ที่สองที่ขอ teleop ต้องถูกปฏิเสธจนกว่าคนแรกจะปล่อย และหน้าจอบอกว่าใครคุมอยู่

### ตั้ง parameter จาก web
- ต้องตั้งที่ **node ปลายทางจริง** ผ่าน parameter service ของ node นั้น (`/<node>/set_parameters`) — ไม่ใช่ parameter ของ bridge เอง (ตัวอย่างต้นฉบับอ่าน/เขียนเฉพาะ parameter ของ bridge)
- เปิดให้แก้เฉพาะ parameter ใน allowlist พร้อมช่วงที่อนุญาต, ตรวจช่วงที่ bridge อีกชั้น แล้ว **อ่านกลับ** มายืนยัน — ตาม [../patterns/config.md](../patterns/config.md)
- ค่าที่ตั้งผ่าน service ไม่ถูกบันทึกลง YAML → ถ้าต้องการให้คงอยู่หลัง restart ต้องเขียนไฟล์ config แยก แล้วบอกผู้ใช้

## เขียน bridge ด้วย Python (rclpy + FastAPI)
- **rclpy executor รันใน thread แยก** (`MultiThreadedExecutor` ใน background thread), web server (uvicorn, worker เดียว) รันใน main thread — ห้าม `rclpy.spin()` ใน handler ของ HTTP
- ข้อมูลที่ callback ของ ROS เขียน และ handler ของ web อ่าน ต้องป้องกันด้วย lock (หรือส่งผ่าน queue)
- ห้ามเรียก service แบบ synchronous ใน async handler — ใช้ `call_async()` แล้วรอ future แบบไม่บล็อก event loop
- shutdown: หยุด executor ก่อน `rclpy.shutdown()` และ join thread แบบมี timeout
- รันด้วย PM2/systemd พร้อม env เดียวกับ node อื่น (`ROS_LOCALHOST_ONLY`, `ROS_DOMAIN_ID`)

## ความปลอดภัยใน LAN
- คนที่ต่อ LAN เครื่องจักรได้ ไม่ควรสั่งเครื่องได้ทุกคน → endpoint ที่สั่งงาน/แก้ค่า/teleop ต้องมี login (อย่างน้อยแยก operator / engineer); endpoint อ่านอย่างเดียวเปิดได้ใน LAN ที่แยกแล้ว
- CORS: ระบุ origin ของหน้า dashboard ตรงๆ ห้าม `*`
- HTTPS: ใน LAN ที่ไม่มี internet ใช้ certificate ที่ออกเอง (self-signed / CA ภายใน) ผ่าน nginx/caddy ถ้าต้องการ — ถ้าใช้ HTTP ใน LAN แยก ให้บอกผู้ใช้ว่ารหัสผ่านวิ่งแบบไม่เข้ารหัส
- browser library (roslibjs ฯลฯ) เก็บไฟล์ไว้ในโปรเจกต์ ไม่โหลดจาก CDN

## ทดสอบ
- ใช้ข้อมูลจำลองก่อน: `ros2 topic pub` ป้อนค่าให้ bridge หรือ bag file
- ทดสอบ: ปิด browser ระหว่างกด jog → robot หยุดภายใน timeout, ดึงสาย LAN ของ tablet, เปิด 2 browser แย่ง teleop, client ช้า (DevTools network throttling) → ไม่มีคิวค้าง
