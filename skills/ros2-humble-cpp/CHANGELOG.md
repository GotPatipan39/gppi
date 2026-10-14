# CHANGELOG — ros2-humble-cpp

## 3.2.3 — 2026-10-14
แก้ template ที่คุม hardware (จากรีวิว docs/reviews/2026-10-14-skills.md) — ทำแบบ TDD: เห็น test แดงก่อนแก้ทุกข้อ
- **watchdog ใช้ ROS time** (`now()`): `use_sim_time:=true` บนเครื่องจริงที่ไม่มี `/clock` ทำให้เวลาหยุดเดิน watchdog ไม่มีวันตัด → แยกเป็น `templates/command_watchdog.hpp` ใช้ steady clock, เริ่มต้นแบบหมดเวลา (= หยุดจนกว่าจะได้คำสั่งแรก); node ใช้ steady clock สำหรับ dt ของ ramp ด้วย
- **NaN/Inf ผ่าน clamp**: `std::clamp(NaN, …)` คืน NaN แล้วค้างใน ramp → ส่งไป hardware — node ไม่นับคำสั่งที่ไม่ใช่ตัวเลขจริง (ไม่ feed watchdog) และ `RateLimiter` ถือ target ที่ไม่ใช่ตัวเลขจริงเป็น 0
- **dt เป็น NaN ทำให้ ramp กระโดดถึง target ทันที** (เจอระหว่างเขียน test — clamp กับ limit ที่เป็น NaN คืน delta ทั้งก้อน) → dt ที่ไม่ใช่ตัวเลขจริงไม่ขยับ
- **ramp ข้ามศูนย์ใน step เดียว** (0.1 → -0.1) ทั้งที่ comment บอกว่าผ่าน 0 แล้ว — drive ที่ใช้ bit ทิศทางต้องเห็น 0 ก่อนกลับทิศ → หยุดที่ 0 หนึ่งรอบก่อน
- ทดสอบ: gtest 12/12 (g++ 11.4); `node_template.cpp` compile ผ่านกับ rclcpp จำลอง — ยังไม่ได้ build กับ ROS2 Humble จริง

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
