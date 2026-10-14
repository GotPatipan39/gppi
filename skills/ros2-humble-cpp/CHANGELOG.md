# CHANGELOG — ros2-humble-cpp

## 3.4.0 — 2026-10-14
- เพิ่ม `references/odometry.md` (เขียนเอง ไม่ได้มาจาก upstream): ใช้ `diff_drive_controller` ถ้ามี ros2_control, integrate encoder แบบ midpoint, counter wrap 16/32-bit, ปฏิเสธ step ที่เร็วเกินจริง (drive reset) แล้ว re-base, ไม่ integrate ข้ามช่วงที่อ่านไม่ได้, reject ติดกันหลายรอบ = odometry เสีย → ERROR + หยุด publish (ไม่ปล่อย pose ค้างแบบเงียบ), อ่านทุก counter ใน request เดียว, quadrature ×4, `publish_tf` เมื่อมี EKF, calibration ที่ผู้ใช้เป็นคนรัน (แก้ radius ก่อนแล้วค่อยวัด separation) — โค้ดและ gtest 9 ตัวใน reference ผ่านกับ g++ 11.4 + `-Werror` และ mutation 5 แบบถูกจับครบ (`tools/test-templates.sh` ดึงจาก markdown มารันใน CI); `safety-reviewer` พบ 🔴 1 (pose ค้างเงียบเมื่อ reject ต่อเนื่อง) + 🟡 6 แก้ครบแล้ว; parameter ของ `diff_drive_controller` ตรวจกับ yaml ของ branch humble
- `ParameterDescriptor` สำหรับ parameter ด้านความปลอดภัย: `read_only` + range — ตรวจกับ source ของ rclcpp humble ว่า range ถูกตรวจตอน declare (throw) และตอน set; range ไม่กัน NaN
- บอกว่า Humble EOL พฤษภาคม 2027 ให้แจ้งผู้ใช้ตอนเริ่มโปรเจกต์ใหม่

## 3.3.0 — 2026-10-14
ล้างเนื้อหาที่ผิดสำหรับ Humble (จากรีวิว docs/reviews/2026-10-14-skills.md กลุ่ม 2) — แก้เอกสารเท่านั้น ยังไม่ได้ build ตัวอย่าง C++ ใหม่กับ Humble จริง
- **reference ที่หาย**: เพิ่ม `deployment.md` (systemd/pm2 บน mini PC, `sd_notify` + `NotifyAccess=all`, rollback, shutdown บน Humble), `runtime-provenance.md`, `system-diagnostics.md` ดัดแปลงจาก upstream @4ee4dea เป็น Humble; ตัดการอ้างถึง realtime/security/simulation/multi-robot/sensor-integration/engineering-principles และ `scripts/*.py`; เพิ่ม `references/LICENSE` (Apache-2.0)
- **hardware-interface**: ตัวอย่างหลักเป็น ros2_control 2.x ของ Humble (เดิมเป็น API 4.x ของ Jazzy ซึ่ง build บน Humble ไม่ผ่าน); chaining และ mecanum/ackermann/bicycle/tricycle มีใน Humble แล้ว (เดิมบอก Jazzy+/Kilted+); gripper บน Humble คือ `gripper_controllers`; กับดัก `diff_drive_controller` `use_stamped_vel=true` → `~/cmd_vel_unstamped`
- **systemd**: unit `Type=notify` ต้องมี `NotifyAccess=all` (node ใต้ `ros2 launch` เป็น child process) — ไม่มี sd_notify ให้ใช้ `Type=simple`; ทุก unit ตั้ง `ROS_LOCALHOST_ONLY=1` + `ROS_DOMAIN_ID` จาก CLAUDE.md; `ROS_DISTRO=jazzy` → humble
- **executor/comm**: EventsExecutor ไม่มีใน Humble (Iron+); StaticSingleThreaded ไม่ deprecated ใน Humble; intra-process + KEEP_ALL/TRANSIENT_LOCAL บน Humble **throw**; content filter มีตั้งแต่ Humble แต่ CycloneDDS ไม่รองรับ; service introspection ไม่มีใน Humble
- **CLI/tools**: `ros2 topic echo` บน Humble ปรับ QoS ตาม publisher; `ros2 trace` ไม่มี start/stop; MCAP ต้องลง plugin + `-s mcap`; `ros2 bag record` ไม่มี `--max-duration`/retention
- **launch/build**: Python launch เป็นหลัก (ตรงกับ SKILL.md); `robot_description` ผ่าน topic ไม่ใช่ parameter; `ament_target_dependencies` เป็นแบบแนะนำของ Humble; template install header ไป `include/${PROJECT_NAME}`
- **CI**: ตัวอย่างเป็น `ros:humble` + เพิ่ม `.gitlab-ci.yml` (ทีมใช้ GitLab)
- **กฎทีม**: คำเตือน localhost-only ก่อนตัวอย่าง multi-machine/firewall; ถามผู้ใช้ก่อน `ros2 run`/`lifecycle set`/launch/activate controller บนเครื่องจริง; ค่า hardware ในตัวอย่างเป็น placeholder
- รีวิวผิดหนึ่งข้อ: `parallel_gripper_action_controller` ไม่มีใน Humble — ไม่ได้ใส่
- ตาม 🟡 ของ safety-reviewer (2 ชุด, ไม่มี 🔴):
  - **auto-restart ของ driver ปิดเป็นค่าเริ่มต้น** ในตัวอย่าง systemd/pm2 — เปิดได้เมื่อยืนยันว่า driver เริ่มใน safe state และ drive มี comm timeout; `StartLimitBurst`/`max_restarts` จับได้แค่ crash loop ที่เร็ว
  - watchdog ของ systemd kill ด้วย SIGABRT = **ไม่มีการสั่งหยุดอุปกรณ์** → Option B ต้องมี comm timeout ฝั่ง drive
  - I/O อยู่ใน thread แยก → ping watchdog / heartbeat ต้องผูกกับความคืบหน้าของ I/O loop ไม่งั้น watchdog ไม่ fire; ตอนปิดต้องหยุด I/O thread ก่อนส่ง stop
  - rollback = ทำ safe state + verify ซ้ำ และเช็กว่า config เข้ากับ release เก่า; build บนเครื่องจริงไปที่ release dir ใหม่ (ถามก่อน)
  - ตัวอย่าง chaining: reference เริ่มเป็น NaN และไม่ค้างค่าเก่าเมื่อไม่มีแหล่ง reference (NaN → effort 0 + reset PID พร้อมคำเตือนเรื่องแรงโน้มถ่วง); `write()` ข้าม NaN ปลอดภัยเฉพาะ position interface

## 3.2.4 — 2026-10-14
- description: เพิ่ม trigger ให้ตรงกับตาราง "ใช้ skill ตามงาน" ใน rules.md — Claude เลือก skill จาก description ถ้าไม่มีคำเหล่านี้ skill จะไม่ถูกโหลดในงานที่ตารางสั่งไว้ (จากรีวิว กลุ่ม 3): bringup/systemd, ros2_control, lifecycle, rosbag, e-stop/watchdog

## 3.2.3 — 2026-10-14
แก้ template ที่คุม hardware (จากรีวิว docs/reviews/2026-10-14-skills.md) — ทำแบบ TDD: เห็น test แดงก่อนแก้ทุกข้อ
- **watchdog ใช้ ROS time** (`now()`): `use_sim_time:=true` บนเครื่องจริงที่ไม่มี `/clock` ทำให้เวลาหยุดเดิน watchdog ไม่มีวันตัด → แยกเป็น `templates/command_watchdog.hpp` ใช้ steady clock, เริ่มต้นแบบหมดเวลา (= หยุดจนกว่าจะได้คำสั่งแรก); node ใช้ steady clock สำหรับ dt ของ ramp ด้วย
- **NaN/Inf ผ่าน clamp**: `std::clamp(NaN, …)` คืน NaN แล้วค้างใน ramp → ส่งไป hardware — node ไม่นับคำสั่งที่ไม่ใช่ตัวเลขจริง (ไม่ feed watchdog) และ `RateLimiter` ถือ target ที่ไม่ใช่ตัวเลขจริงเป็น 0
- **dt เป็น NaN ทำให้ ramp กระโดดถึง target ทันที** (เจอระหว่างเขียน test — clamp กับ limit ที่เป็น NaN คืน delta ทั้งก้อน) → dt ที่ไม่ใช่ตัวเลขจริงไม่ขยับ
- **ramp ข้ามศูนย์ใน step เดียว** (0.1 → -0.1) ทั้งที่ comment บอกว่าผ่าน 0 แล้ว — drive ที่ใช้ bit ทิศทางต้องเห็น 0 ก่อนกลับทิศ → หยุดที่ 0 หนึ่งรอบก่อน
- ทดสอบ: gtest 12/12 (g++ 11.4); `node_template.cpp` compile ผ่านกับ rclcpp จำลอง — ยังไม่ได้ build กับ ROS2 Humble จริง
- ตาม 🟡 ของ safety-reviewer (commit ถัดไป, TDD):
  - **dt มีเพดาน** (`RateLimiter(max_up, max_down, max_dt)`; node ใช้ 2 รอบของ timer) — executor ค้างหลายวินาทีแล้วคำสั่งมาก่อน timer รอบถัดไป ramp จะไม่กระโดดถึงความเร็วสูงสุด
  - **parameter ผิด = node ไม่ start**: `RateLimiter`/`CommandWatchdog` throw เมื่อค่าไม่ใช่ตัวเลขจริงหรือ ≤ 0 (NaN accel = ramp กระโดด, ติดลบ = clamp UB, timeout Inf = ไม่มีวันตัด, rate_hz 0 = หารศูนย์); node ตรวจ `max_speed` ด้วย
  - **คำสั่ง NaN/Inf → เป้าเป็น 0 ทันที** (ชะลอด้วย decel) และไม่ feed watchdog — เดิมวิ่งด้วยคำสั่งดีล่าสุดต่อจนครบ timeout; ตรวจทุก field ของ Twist ไม่ใช่แค่ `linear.x`
  - TODO ใน `send_command`: เขียน 0 ตอนกลับทิศไม่สำเร็จ = ค้างที่ 0 ห้ามส่งทิศใหม่
  - gtest 15/15; ชุดทดสอบเก็บไว้ที่ `tools/test-templates.sh` และรันใน CI
- ตาม 🟡 รอบสอง (TDD):
  - `CommandWatchdog(timeout_s, check_period_s)`: timeout ต้อง ≥ 3 รอบของ timer (rate 0.5 Hz กับ timeout 0.5 s = ตรวจทุก 2 s) และต้องแปลงเป็น duration ได้ (`1e300` overflow = UB) — ไม่ใส่เพดานของงาน ค่าจริงมาจากโปรเจกต์
  - `RateLimiter` ไม่มีค่าเริ่มต้นของ `max_dt` แล้ว — คนใช้ต้องเลือกตาม rate ของ loop; เพดาน dt มีผลกับขาชะลอด้วยโดยตั้งใจ (ชะลอทีละ max_dt ตอน executor ค้าง, watchdog ยังตัดทันทีเมื่อครบ timeout)
  - `main` จับ `std::invalid_argument` → log FATAL + exit 1 แทน abort; comment ว่า drive/PLC ต้องมี comm timeout ของตัวเอง เพราะ node ที่ start ไม่ขึ้นหรือ crash จะไม่ส่ง 0 ให้
  - gtest 16/16

## 3.2.2 — 2026-10-14
- แก้ลิงก์เสีย: `references/safety-estop.md` และ `references/testing.md` อ้างถึง `references/evidence-progression.md` 4 จุด แต่ไฟล์นี้ไม่เคยมีใน repo (ตกหล่นตอนดัดแปลง references มา) — Claude ที่ตามลิงก์ไปจะไม่ได้เนื้อหาอะไร
  - `safety-estop.md` §5: ย้ายหลัก "recovery ห้ามส่งคำสั่งที่ค้างตอน stop ซ้ำ" ขึ้นต้นหัวข้อ (เนื้อหาเดียวกับที่หัวข้อเขียนไว้แล้วข้างล่าง)
  - `testing.md`: "authorization แยกจาก execution" ชี้ไปที่กฎที่มีอยู่แล้วใน `rules.md` ของ gppi (ต้องได้คำสั่งชัดจากผู้ใช้ก่อนแตะเครื่องจริง) แทนไฟล์ที่ไม่มี
  - ยังไม่ได้เขียน `evidence-progression.md` ขึ้นมาใหม่ — เป็นแนวปฏิบัติความปลอดภัยใหม่ ต้องให้เจ้าของ repo รีวิวก่อน

## 3.2.1 — 2026-10-08
- แก้ `references/perception.md`: `#include <cv_bridge/cv_bridge.hpp>` → `cv_bridge.h` ทั้ง 4 จุด — Humble มีแค่ `.h` (ตรวจจาก branch `humble` ของ ros-perception/vision_opencv) ตัวอย่างเดิม build ไม่ผ่านบน Humble
- งานภาพ (กล้อง, calibration, หาตำแหน่ง/วัดขนาด/QR) อยู่ใน skill `opencv` — ไฟล์นี้คงไว้แค่ส่วนต่อเข้า ROS2

## 3.2.0 — 2026-10-02
- ตาราง reference ชี้งาน Web UI ↔ ROS2 ไปที่ skill `industrial-ui` (platforms/ros2-bridge.md)

## 3.1.0 — 2026-10-02
- เพิ่มหัวข้อ "ขอบเขต network": ค่าเริ่มต้น local เท่านั้น (`ROS_LOCALHOST_ONLY=1`, `ROS_DOMAIN_ID`), เงื่อนไขการคุยข้ามเครื่อง, ห้ามพึ่ง internet ตอนรัน, การติดตั้งแบบ offline
- เพิ่มแถวในตารางปัญหาที่เจอบ่อย

## 3.0.0 — 2026-10-02
- ตัดข้อมูลเฉพาะ AGV ออก (ย้ายไป `CLAUDE.md` ของโปรเจกต์) → skill เป็นแบบทั่วไป
- เพิ่มกฎ "Humble เท่านั้น" เพราะ references ครอบคลุมหลาย distro
- เพิ่มส่วนสภาพแวดล้อม Windows + WSL / mini PC
- เพิ่มกฎ ramp, กลับทิศ, watchdog ฝั่งอุปกรณ์, ห้ามเดาค่า hardware
- เพิ่ม template: package.xml, CMakeLists.txt, example.launch.py, params.yaml, rate_limiter.hpp, test_example.cpp
- node_template ใช้ ramp แล้ว
- ย้ายโค้ด Modbus ไป skill `modbus`

## 2.0.0 — 2026-10-01
- เพิ่มหลักการทำงานและ references จาก ros2-engineering-skills v1.6.2 (Apache-2.0)

## 1.0.0 — 2026-09-30
- เวอร์ชันแรก
