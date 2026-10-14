# CHANGELOG — opencv

## 1.0.2 — 2026-10-14
- `references/tasks.md`: BarcodeDetector ของ 4.5.x (contrib) กับ 4.8+ API ต่างกัน (`detectAndDecode` + `BarcodeType` vs `detectAndDecodeWithType`) — ตัวอย่างจาก internet ส่วนใหญ่ใช้กับ 4.5.4 ของ Humble ไม่ได้

## 1.0.1 — 2026-10-12
- เขียน/แก้ logic ประมวลผลภาพ → สั่งให้โหลด `tdd` ด้วยทันที (เหตุผลเดียวกับ `modbus` 1.1.0: skill ความรู้ถูกโหลดแต่ `tdd` หลุด)

## 1.0.0 — 2026-10-08
- เวอร์ชันแรก: machine vision ด้วย OpenCV (Python + C++) ทั้งใน ROS2 node และโปรแกรมแยก — งาน นับ/ตรวจว่ามีของ, วัดขนาด/ของเสีย, หาตำแหน่งให้ robot, QR/barcode; กล้อง UVC, industrial (GigE/USB3 Vision), depth (RealSense), RTSP
- กฎ: ผลมีสถานะแยก "ไม่รู้" (NO_IMAGE/NOT_FOUND) จาก OK/NG, ใช้ภาพล่าสุด + เช็คอายุภาพ, ไม่ส่งผลรอบก่อนซ้ำ, เช็ค workspace limit ก่อนส่งให้ robot, ล็อก exposure, ไม่มี imshow ในโค้ดที่รันจริง, ห้ามเดาค่า
- สภาพแวดล้อม: Ubuntu 22.04/Humble ใช้ OpenCV 4.5.4 ของระบบ ไม่ pip install opencv-python ซ้อน; API ที่ไม่มีใน 4.5.4 (ArucoDetector, BarcodeDetector ใน main, QRCodeDetectorAruco)
- ทดสอบด้วยชุดภาพจริงที่มี label (ต่อกับ skill `tdd`) และเทียบการวัดกับเครื่องมือวัดจริง
- ที่มา: ตรวจ tondevrel/scientific-agent-skills `opencv` @ 6e89d9e แล้วไม่ใช้ (ดูตาราง "ตรวจแล้ว" ใน README) — เนื้อหาเขียนใหม่ทั้งหมดจากงานของเรา
