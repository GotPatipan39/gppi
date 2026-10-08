# CHANGELOG — tdd

## 1.0.0 — 2026-10-08
- เวอร์ชันแรก: ลูป red → green → refactor, ตกลง seam กับผู้ใช้ก่อนเขียน test (โน้ตว่าจับอะไรได้/ไม่ได้), anti-patterns, รายงานระดับการทดสอบ
- ตัวอย่างเป็นงานของเรา: แปลง register/float32/int16 (C++ gtest, Python pytest), state machine + interlock, alarm ใน Node-RED (`node --test`)
- mock ที่ขอบ hardware: fake อุปกรณ์ที่จำลองการไม่ตอบได้, นาฬิกาปลอมสำหรับ watchdog, ห้ามแตะเครื่องจริงและห้ามลด timeout/limit เพื่อให้ test ผ่าน
- ดัดแปลงจาก mattpocock/skills `tdd` @ 3f59913 (MIT): seam ที่ตกลงก่อน, anti-pattern tautological / ผูกกับ implementation / horizontal slicing, mock เฉพาะขอบระบบ, ออกแบบด้วย dependency injection และ interface แบบ SDK — ไม่เอา: การเรียก skill `codebase-design` และ `code-review` ของเขา (เราไม่มี), การตัด refactor ออกจากลูป (ใช้ red-green-refactor ตามปกติ), ตัวอย่าง TypeScript/checkout
