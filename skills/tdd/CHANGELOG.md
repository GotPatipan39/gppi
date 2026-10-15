# CHANGELOG — tdd

## 1.1.1 — 2026-10-15
- logic ที่มีลำดับ/เงื่อนไข: ใช้ flowchart ที่ผู้ใช้ OK (skill `flowchart`) เป็นรายการ test — ทุกทางออกของทุกทางแยก

## 1.1.0 — 2026-10-14
- แก้: ตัวอย่าง `node --test test/` fail บน Node 22/24 (ไม่ค้นใน directory) → `node --test` ไม่ใส่ argument; ใช้ Node ≥ 20
- restart Node-RED หลังแก้ `lib/*.js` = หยุด flow ที่คุมเครื่อง → Claude ไม่ restart เอง บอกผู้ใช้แทน
- เพิ่ม property-based test (hypothesis/fast-check, ถามก่อนติดตั้ง) สำหรับ invariant ด้านความปลอดภัย พร้อมตัวอย่าง ramp ที่รวม NaN
- เพิ่มตารางขั้นถัดจาก unit: simulator บน localhost → hardware ไม่มีโหลด (ผู้ใช้รัน) → ใช้งานจริง

## 1.0.0 — 2026-10-08
- เวอร์ชันแรก: ลูป red → green → refactor, ตกลง seam กับผู้ใช้ก่อนเขียน test (โน้ตว่าจับอะไรได้/ไม่ได้), anti-patterns, รายงานระดับการทดสอบ
- ตัวอย่างเป็นงานของเรา: แปลง register/float32/int16 (C++ gtest, Python pytest), state machine + interlock, alarm ใน Node-RED (`node --test`)
- mock ที่ขอบ hardware: fake อุปกรณ์ที่จำลองการไม่ตอบได้, นาฬิกาปลอมสำหรับ watchdog, ห้ามแตะเครื่องจริงและห้ามลด timeout/limit เพื่อให้ test ผ่าน
- ดัดแปลงจาก mattpocock/skills `tdd` @ 3f59913 (MIT): seam ที่ตกลงก่อน, anti-pattern tautological / ผูกกับ implementation / horizontal slicing, mock เฉพาะขอบระบบ, ออกแบบด้วย dependency injection และ interface แบบ SDK — ไม่เอา: การเรียก skill `codebase-design` และ `code-review` ของเขา (เราไม่มี), การตัด refactor ออกจากลูป (ใช้ red-green-refactor ตามปกติ), ตัวอย่าง TypeScript/checkout
