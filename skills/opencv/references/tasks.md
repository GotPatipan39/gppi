# งาน vision แต่ละแบบ

ทุกค่าที่เป็นตัวเลขของงาน (ROI, threshold, พื้นที่ min/max, mm/px, tolerance, รูปแบบรหัส, workspace limit) อยู่ใน config ของโปรเจกต์ — ตัวอย่างข้างล่างใช้ชื่อตัวแปรแทนค่า ห้ามเติมเลขเอง

## 1. Camera calibration (intrinsics)
ทำก่อนงานที่วัดระยะหรือหาตำแหน่ง — เลนส์ทุกตัวมี distortion โดยเฉพาะขอบภาพ
```python
ok, corners = cv2.findChessboardCorners(gray, (cols, rows))           # จำนวนมุมด้านใน ไม่ใช่จำนวนช่อง
corners = cv2.cornerSubPix(gray, corners, (11, 11), (-1, -1),
                           (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 1e-3))
# รวบรวมจากหลายภาพ (บอร์ดหลายมุม หลายตำแหน่ง เต็มพื้นที่ภาพ) แล้ว
rms, K, dist, _, _ = cv2.calibrateCamera(obj_pts, img_pts, (w, h), None, None)
```
- `rms` (reprojection error, pixel) ต้องต่ำ — สูงผิดปกติแปลว่ามีภาพเบลอ/มุมหาผิด ให้ตัดภาพนั้นแล้วทำใหม่ จด `rms` ไว้กับไฟล์ผล
- เก็บ `K`, `dist`, ความละเอียด, วันที่ ด้วย `cv2.FileStorage` (yaml) ใน config ของโปรเจกต์
- **calibrate ใหม่ทุกครั้งที่เปลี่ยนเลนส์, focus, zoom หรือความละเอียด** — ล็อก focus ไว้
- undistort ทั้งภาพ: สร้าง map ครั้งเดียวด้วย `cv2.initUndistortRectifyMap` แล้ว `cv2.remap` ทุกเฟรม (เร็วกว่า `cv2.undistort` ทุกเฟรม) หรือ undistort เฉพาะจุดที่หาได้ด้วย `cv2.undistortPoints`
- ROS2: ใช้ package `camera_calibration` ได้ — ขนาดบอร์ดและขนาดช่องใส่ตามบอร์ดจริงที่วัดแล้ว

## 2. Pixel → mm / พิกัด robot บนระนาบ
ชิ้นงานอยู่บนระนาบเดียว (สายพาน, โต๊ะ) ใช้ homography จากจุดที่รู้พิกัดจริง ≥ 4 จุด (ใช้มากกว่า 4 ช่วยเฉลี่ย error) กระจายทั่วพื้นที่ทำงาน
```python
H, _ = cv2.findHomography(img_pts_undistorted, world_pts_mm)          # world = mm บนโต๊ะ หรือพิกัด robot
xy_mm = cv2.perspectiveTransform(pts_px.reshape(-1, 1, 2).astype(np.float32), H).reshape(-1, 2)
```
- **ได้พิกัด robot ตรงๆ ง่ายที่สุด**: ทำเครื่องหมายบนโต๊ะ, jog robot ไปแตะแล้วจดพิกัด, ถ่ายภาพหาตำแหน่ง pixel ของเครื่องหมาย → homography จาก pixel ไปพิกัด robot (การ jog คือการสั่งเครื่องขยับ — ผู้ใช้เป็นคนทำ)
- **ตรวจด้วยจุดที่ไม่ได้ใช้คำนวณ** แล้วรายงาน error สูงสุดเป็น mm — ไม่ใช่แค่ error ของจุดที่ใช้ fit
- ชิ้นงานสูงต่างจากระนาบที่ calibrate → ตำแหน่งเพี้ยน (ยิ่งห่างกลางภาพยิ่งเพี้ยน) ชิ้นงานหลายความสูงต้องแก้ด้วยความสูงหรือใช้ depth/3D
- กล้องติดบน robot (eye-in-hand) หรือต้องการ 3D: hand-eye calibration (`cv2.calibrateHandEye`) — ซับซ้อนกว่ามาก คุยกับผู้ใช้ก่อนเลือกวิธี
- **ก่อนส่งให้ robot**: เช็คว่าพิกัดอยู่ใน workspace limit จาก config, มุมอยู่ในช่วงที่ gripper หมุนได้ — ไม่ผ่าน = NOT_FOUND

### มุมของชิ้นงาน
- `cv2.minAreaRect` **เปลี่ยนช่วงมุมที่คืนในรุ่น 4.5** — ตัวอย่างเก่าบน internet ใช้ช่วงคนละแบบกับ 4.5.4 อย่าเชื่อสูตรแปลงมุมจากตัวอย่าง ให้คำนวณมุมเองจาก `cv2.boxPoints` (ด้านยาว) แล้ว normalize ให้อยู่ในช่วงที่ robot ต้องการ
- ชิ้นงานสมมาตร (สี่เหลี่ยม, วงกลม) มีมุมหลายค่าที่ถูก — เลือกค่าที่ robot หมุนน้อยสุด และ test ที่ขอบช่วง (เช่น ชิ้นงานเอียงเกือบ 90°)

## 3. นับ / ตรวจว่ามีของไหม
- **ตรวจว่ามีของในตำแหน่งที่รู้อยู่แล้ว** (ช่องใน tray, ตำแหน่งบน jig): ROI คงที่ต่อช่อง แล้วดูค่าเฉลี่ยความสว่าง หรือจำนวน pixel หลัง threshold เทียบกับเกณฑ์ — ง่ายและทนกว่าการหา contour
- **นับชิ้นงานที่วางกระจาย**: threshold (Otsu หรือค่าคงที่ ถ้าแสงคุมได้) → morphology ลบ noise → `findContours(RETR_EXTERNAL)` → กรองด้วยพื้นที่ `area_min..area_max`
  - contour ที่ใหญ่เกิน `area_max` คือชิ้นงานติดกัน — อย่าหารพื้นที่เดาจำนวนเงียบๆ ให้แยกด้วย distance transform + watershed หรือรายงานเป็นสถานะแยก ("ติดกัน ตรวจไม่ได้") ตามที่ตกลงกับผู้ใช้
  - เซฟภาพ debug ที่วาด contour + เลขพื้นที่ — ใช้ปรับ `area_min/max` จากภาพจริง
- background subtraction (MOG2) ใช้ได้กับกล้องนิ่งและแสงคงที่เท่านั้น — แสงเปลี่ยนหรือมีคนเดินผ่านจะนับผิด

## 4. วัดขนาด / ตรวจของเสีย
- undistort ก่อนวัดเสมอ และใช้ mm/px จาก homography (ข้อ 2) ไม่ใช่จากการวัดไม้บรรทัดในภาพครั้งเดียว
- **เช็คความละเอียดตั้งแต่ออกแบบ**: ถ้า 1 pixel ใหญ่ใกล้เคียง tolerance ที่ต้องวัด ระบบวัดไม่ได้จริง ต้องเพิ่มความละเอียดกล้องหรือลดพื้นที่ภาพ — บอกผู้ใช้ก่อนเขียนโค้ด
- ขอบชิ้นงาน: แสง backlight ให้ขอบคมที่สุด; ใช้ `cornerSubPix`/fit เส้น (`cv2.fitLine`) หรือ fit วงกลมจากจุดขอบ เพื่อได้ความละเอียดต่ำกว่า pixel
- ตรวจของเสียแบบเทียบกับชิ้นดี: จัดตำแหน่งภาพให้ตรงกับภาพต้นแบบก่อน (หาจุดอ้างอิง/`cv2.findTransformECC`) แล้ว `cv2.absdiff` + threshold + กรองพื้นที่ — ถ้าไม่จัดตำแหน่งก่อน ขอบชิ้นงานจะกลายเป็น "ของเสีย" ทั้งหมด
- ผลต้องเก็บค่าที่วัดได้ (mm) ไม่ใช่แค่ OK/NG — ใช้ดู drift และเทียบกับเกจ

## 5. QR / barcode
```python
det = cv2.QRCodeDetector()
data, pts, _ = det.detectAndDecode(gray)
if pts is None or not data:
    result = Result(Status.NOT_FOUND)
else:
    pts = pts.reshape(-1, 2)     # รูปร่างของ pts ต่างกันตามเวอร์ชัน — reshape ก่อนใช้เสมอ
```
- หลาย QR ในภาพเดียว: `detectAndDecodeMulti`
- barcode 1D: 4.5.4 ไม่มี `BarcodeDetector` ใน main module — เช็ค `hasattr(cv2, "barcode_BarcodeDetector")` (contrib) ก่อน; ไม่มีให้ใช้ zbar (`libzbar0` + `python3-pyzbar`, C++ `libzbar-dev` จาก apt)
  - API ต่างกันตามรุ่น: 4.5.x (contrib) `detectAndDecode` คืนชนิด barcode (`BarcodeType`) มาด้วย; 4.8+ ย้ายเข้า main และเปลี่ยนเป็น `detectAndDecodeWithType` ซึ่งคืนชนิดเป็น **string** ไม่ใช่ enum `BarcodeType` — ตัวอย่างจาก internet ส่วนใหญ่เป็นแบบ 4.8+ ใช้กับ 4.5.4 ของ Humble ไม่ได้ (https://docs.opencv.org/4.5.4/dc/df7/classcv_1_1barcode_1_1BarcodeDetector.html)
- Data Matrix: zbar อ่านไม่ได้ — ใช้ libdmtx (`pylibdmtx`) หรือ SDK ของกล้อง
- **ตรวจรูปแบบข้อมูลที่อ่านได้** (ความยาว, prefix, regex, check digit ตาม config) — อ่านได้แต่รูปแบบผิด = NG ไม่ใช่ OK
- อ่านไม่ออกบ่อย: แก้ที่แสง/ความละเอียด/มุมกล้องก่อน แล้วค่อยลอง preprocess (crop ROI, ขยายภาพ, threshold)
- งานที่ต้องการความชัวร์: อ่านจากหลายเฟรมแล้วต้องได้ค่าเดียวกัน
