---
name: opencv
description: ใช้เมื่อเขียน แก้ หรือ debug งาน machine vision ด้วย OpenCV (Python cv2 หรือ C++ cv::Mat) — นับ/ตรวจว่ามีชิ้นงาน, วัดขนาด/ตรวจของเสีย, หาตำแหน่งชิ้นงานส่งให้ robot (pixel → mm, homography, hand-eye), อ่าน QR/barcode, camera calibration — ต่อกล้อง USB/UVC, industrial camera (GigE/USB3 Vision), depth camera (RealSense), IP camera (RTSP) — ทั้งใน ROS2 node และโปรแกรมแยกที่ส่งผลไป PLC/Node-RED
---

# OpenCV สำหรับงาน machine vision

> เวอร์ชัน 1.0.1 — ดู [CHANGELOG.md](CHANGELOG.md)

งาน vision ที่หน้างานต่างจากตัวอย่างใน tutorial ตรงที่ **ผลของมันไปสั่งเครื่อง** — นับผิดคือส่งของขาด, ตำแหน่งผิดคือ robot ชน, กล้องหลุดแล้วรายงานว่า "ไม่มีของเสีย" คือปล่อยของเสียออกไป
skill นี้เน้นสิ่งที่ทำให้ระบบ vision เชื่อถือได้ ไม่ใช่รายการ function ของ OpenCV

| เรื่อง | ไฟล์ |
|---|---|
| เปิดกล้องแต่ละแบบ, exposure, trigger, RTSP latency, depth | [references/cameras.md](references/cameras.md) |
| นับ/ตรวจว่ามีของ, วัดขนาด, หาตำแหน่งให้ robot, QR/barcode, calibration | [references/tasks.md](references/tasks.md) |
| ต่อเข้า ROS2 (`cv_bridge`, `image_transport`, QoS) | skill `ros2-humble-cpp` → `references/perception.md` |
| ส่งผลไป PLC | skill `modbus` |
| แสดงผล/ภาพบน HMI | skill `industrial-ui` |

**เขียนหรือแก้ logic ประมวลผลภาพ** (นับ, วัด, ตัดสิน OK/NG, แปลง pixel → mm/พิกัด robot, ตรวจรูปแบบรหัส) → **โหลด skill `tdd` ด้วยตอนนี้เลย** ก่อนแก้โค้ด — test ด้วยชุดภาพที่เซฟไว้พร้อม label (ข้อ 3) ไม่ใช่ลองกับกล้องจริงแล้วดูด้วยตา

## 0. เช็คสภาพแวดล้อมก่อนเขียนโค้ด
Ubuntu 22.04 + ROS2 Humble ใช้ **OpenCV ของระบบ 4.5.4** (`libopencv-dev`, `python3-opencv` จาก apt) ซึ่ง `cv_bridge` ถูก build มากับตัวนี้
- **อย่า `pip install opencv-python` บนเครื่องที่มี ROS2** — จะได้ cv2 อีกตัวที่ซ้อนกัน import ได้ตัวที่ไม่ตั้งใจ, numpy คนละเวอร์ชัน, `cv_bridge` พังแบบงงๆ ถ้าโปรเจกต์ใช้ pip/venv อยู่แล้ว ให้ถามก่อนเปลี่ยน
- ตัวอย่างบน internet ส่วนใหญ่เป็น 4.7+ — API บางตัว **ไม่มีใน 4.5.4**: `cv2.aruco.ArucoDetector` (4.5.4 ใช้ `cv2.aruco.detectMarkers`), `QRCodeDetectorAruco`, `BarcodeDetector` ใน main module — เช็คก่อนใช้:
  ```bash
  python3 -c "import cv2; print(cv2.__version__, cv2.__file__)"
  python3 -c "import cv2; print(cv2.getBuildInformation())" | grep -E "GStreamer|FFMPEG|V4L"
  pkg-config --modversion opencv4
  ```
- โปรแกรมแยกบน Windows หรือเครื่องที่ไม่มี ROS2: ใช้เวอร์ชันที่โปรเจกต์ล็อกไว้ (`requirements.txt`/`CMakeLists.txt`) ไม่เปลี่ยนเอง

## 1. กฎ
- **ห้ามเดาค่า** — exposure, gain, ROI, threshold, mm/px, ขนาดชิ้นงาน, tolerance, พิกัด robot, IP/serial ของกล้อง เอามาจาก config/CLAUDE.md ของโปรเจกต์ ไม่มีให้ถาม ค่าพวกนี้อยู่ใน config file ไม่ hardcode ในโค้ด
- **ผลต้องมีสถานะที่แยก "ไม่รู้" ออกจาก "ไม่มี"** — กล้องหลุด, ภาพเก่า, หาไม่เจอ ต้องไม่กลายเป็น OK หรือ "ไม่มีของเสีย":
  ```python
  from enum import Enum

  class Status(Enum):
      OK = "ok"              # ผ่าน / เจอ
      NG = "ng"              # ตรวจแล้วไม่ผ่าน
      NOT_FOUND = "not_found"  # ภาพปกติแต่หาเป้าหมายไม่เจอ
      NO_IMAGE = "no_image"  # กล้องหลุด / ภาพเก่าเกิน max_age
      ERROR = "error"
  ```
  ฝั่งที่รับผล (PLC/robot/Node-RED) ต้องถือว่าทุกอย่างที่ไม่ใช่ OK = หยุดหรือคัดออก — ตกลงกับผู้ใช้ว่าแต่ละสถานะส่งเป็นค่าอะไร
- **ใช้ภาพล่าสุดเท่านั้น** และเช็คอายุภาพ — กล้องส่งเร็วกว่าที่ประมวลผลทัน ถ้าใช้ queue จะได้ภาพที่ช้าไปเรื่อยๆ (ดู [cameras.md](references/cameras.md) "อ่านภาพล่าสุด")
- **ห้ามส่งผลรอบก่อนซ้ำ** เมื่อรอบนี้ล้มเหลว — ส่ง NO_IMAGE/NOT_FOUND แทน ผลทุกตัวมี timestamp ของภาพที่ใช้
- **ตำแหน่งที่จะส่งให้ robot ต้องผ่านการเช็คขอบเขต** (workspace limit จาก config) ก่อนส่ง — นอกขอบเขต = NOT_FOUND ไม่ clamp ให้เข้าขอบ
- **ล็อก exposure / gain / white balance / focus** — โหมด auto ทำให้ threshold ที่ตั้งไว้ใช้ได้แค่บางช่วงของวัน
- **ไม่มี `cv2.imshow` ในโค้ดที่รันจริง** — mini PC ไม่มีจอ และ `waitKey` บล็อก loop ให้ debug ด้วยการเซฟภาพ (เฉพาะ NG/NOT_FOUND, จำกัดจำนวนไฟล์ ไม่ให้ disk เต็ม) หรือ publish debug image
- **ไม่สั่งเครื่องตอนทดสอบ** — ส่งผลไป PLC/robot = เขียน register/สั่ง motion ตามกฎ global ต้องให้ผู้ใช้สั่งชัดเจน ทดสอบ logic ด้วยภาพที่เซฟไว้ก่อน

## 2. โครงโปรแกรม (ทั้ง ROS2 node และโปรแกรมแยก)
```
กล้อง ──► อ่านภาพล่าสุด (thread แยก) ──► ประมวลผล (pure function: ภาพ + config → Result)
                                              │
                                              ▼
                                  เช็ค Result (อายุภาพ, ขอบเขต) ──► ส่งออก (PLC / topic / Node-RED)
                                              │
                                              └──► เซฟภาพ NG/NOT_FOUND ไว้ debug
```
- **แยก "ประมวลผล" เป็น function ที่ไม่รู้จักกล้องและ ROS2** — รับ `ndarray`/`cv::Mat` + config คืน Result จะ test ด้วยภาพที่เซฟไว้ได้ และใช้ร่วมกันได้ทั้ง node และโปรแกรมแยก
- ROS2 node: subscriber ใช้ QoS sensor data depth 1, ส่ง `header.stamp` ของภาพไปกับผล, งานหนักไม่ทำใน callback ของ single-threaded executor ที่มี timer/service อื่น — รายละเอียดอยู่ใน `ros2-humble-cpp`
- โปรแกรมแยก: รันด้วย systemd/PM2 ให้ restart เองเมื่อตาย, log สถานะกล้อง (เชื่อมต่อ/หลุด/fps) ไม่ใช่แค่ผล

## 3. ทดสอบ
- เก็บ **ชุดภาพจริง** จากหน้างาน: ดี, เสีย, ขอบเขต (เกือบผ่าน/เกือบไม่ผ่าน), แสงต่างกัน, ไม่มีชิ้นงาน — ตั้งชื่อหรือทำไฟล์ label ว่าผลที่ถูกคืออะไร
- test วนทุกภาพผ่าน function ประมวลผล แล้วเทียบกับ label (pytest / gtest) — ค่าที่คาดหวังมาจาก label ที่คนตรวจ ไม่ใช่จากการรันโค้ดแล้วจดผล (ดู skill `tdd`)
- แก้ threshold แล้วรันชุดภาพทั้งหมดใหม่ — ปรับให้ภาพหนึ่งผ่านมักทำให้อีกภาพพัง
- วัดขนาด/ตำแหน่ง: เทียบกับค่าที่วัดด้วยเครื่องมือจริง (เวอร์เนียร์, เกจ, พิกัด robot ที่ jog ไปแตะ) อย่างน้อยหลายจุดทั่วพื้นที่ภาพ ไม่ใช่แค่กลางภาพ
- รายงานระดับการทดสอบ: ชุดภาพที่เซฟไว้ (unit test) / กล้องจริงไม่ต่อเครื่อง / ต่อเครื่องแต่ไม่สั่ง / ใช้งานจริง
