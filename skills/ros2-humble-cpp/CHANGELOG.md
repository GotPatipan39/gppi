# CHANGELOG — ros2-humble-cpp

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
