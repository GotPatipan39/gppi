---
name: tdd
description: ใช้เมื่อเขียน logic ใหม่หรือแก้บั๊กใน logic ที่ test ได้ แบบ test ก่อนโค้ด (red → green → refactor) — เช่น แปลงค่า register/scale/หน่วย, สูตรคำนวณ, state machine, parser ข้อความ/protocol, เงื่อนไข alarm/interlock, timeout/watchdog — ทุกภาษา (C++ gtest, Python pytest, JS/Node-RED node --test) โดย mock ที่ขอบ hardware ไม่แตะเครื่องจริง; ใช้เมื่อผู้ใช้พูดถึง TDD, test-first, red-green-refactor หรือขอให้เขียน test ให้ logic ด้วย
---

# Test-Driven Development

> เวอร์ชัน 1.0.0 — ดู [CHANGELOG.md](CHANGELOG.md)

TDD คือวน: เขียน test ที่ fail → เขียนโค้ดเท่าที่ทำให้ผ่าน → refactor ตอนที่ test เขียวอยู่ → test ถัดไป
skill นี้บอกว่า test แบบไหนควรเก็บไว้ test ไว้ตรงไหน และกฎของลูป — ใช้ทุกรอบ ไม่ใช่อ่านทีหลัง

ถ้าโปรเจกต์มี `GLOSSARY.md` ให้อ่านก่อน เพื่อให้ชื่อ test และชื่อ interface ใช้ศัพท์เดียวกับโปรเจกต์ และเคารพ ADR ใน `docs/adr/` ของส่วนที่กำลังแก้

## ใช้เมื่อไหร่ / ไม่ใช้เมื่อไหร่
**ใช้:** logic ที่ให้ input แล้วตรวจ output ได้ — แปลง data type/word order/scale, คำนวณ odometry/PID/พลังงาน, state machine ของเครื่อง, parser, เงื่อนไข alarm, interlock, retry/timeout
**ไม่ต้องใช้:** แก้สี/layout UI, แก้ค่าใน launch/yaml/config, script ใช้ครั้งเดียว, งาน commissioning ที่ต้องดูของจริง — ถ้าไม่แน่ใจให้ถามผู้ใช้ว่าจะทำแบบ TDD ไหม

## 0. ดูของที่โปรเจกต์มีก่อน
- หา test เดิมและ framework ที่ใช้อยู่ (`test/`, `tests/`, `CMakeLists.txt` ที่มี `ament_add_gtest`/`GTest`, `pytest.ini`/`setup.cfg`, `package.json`) แล้วใช้แบบเดียวกัน
- ไม่มี framework: เสนอตัวที่ไม่ต้องโหลดจาก internet ตอน build — C++ ใช้ `libgtest-dev` ของระบบ (ไม่ใช้ `FetchContent` ดึง gtest), Python ใช้ `pytest` (ถ้ายังไม่มี ให้ถามก่อนติดตั้ง), JS ใช้ `node --test` ที่มากับ Node ≥ 18
- งาน ROS2: วิธีเขียน gtest/launch_testing/mock_components อยู่ใน skill `ros2-humble-cpp` (`references/testing.md`) — skill นี้บอกว่า test อะไร skill นั้นบอกว่าต่อเข้า colcon อย่างไร

## 1. ตกลง seam กับผู้ใช้ก่อนเขียน test
**seam** คือขอบที่เราสังเกตพฤติกรรมได้โดยไม่ต้องล้วงเข้าไปข้างใน (function/class/topic/register ที่คนอื่นเรียก) — test อยู่ที่ seam เท่านั้น
ก่อนเขียน test ตัวแรก เสนอรายการ seam ให้ผู้ใช้ยืนยัน แต่ละข้อมีโน้ตบรรทัดเดียวว่า **จับอะไรได้ / จับอะไรไม่ได้**:

```
seam ที่เสนอ:
1. decode_float32(regs, word_order) — จับ: word order/endianness ผิด | ไม่จับ: อุปกรณ์ส่ง register ผิดตัว
2. MotorStateMachine.on_event()     — จับ: state ข้าม/ค้าง, ลืม interlock | ไม่จับ: timing ของ drive จริง
3. Watchdog.tick(now)               — จับ: ไม่ตัดหลัง timeout | ไม่จับ: thread ค้างจนไม่เรียก tick
```
ไม่เขียน test ที่ seam ที่ยังไม่ได้ตกลง — test ทุกอย่างไม่ได้ การตกลงก่อนทำให้แรงลงที่ logic ที่ซับซ้อนและเสี่ยง ไม่ใช่ edge case ทุกตัว
ค่าที่ใช้ใน test ที่เป็นค่า hardware (scale, word order ของอุปกรณ์, slave ID) **เอามาจาก datasheet/CLAUDE.md ของโปรเจกต์ ห้ามเดา** — ไม่มีให้ถาม

## 2. ลูป red → green → refactor
1. **Red** — เขียน test 1 ตัวสำหรับพฤติกรรมเดียว รันแล้วต้องเห็นมัน fail **ด้วยเหตุผลที่ถูก** (assertion ไม่ตรง ไม่ใช่ include ผิด/พิมพ์ชื่อผิด) ถ้ามันผ่านตั้งแต่แรก แปลว่า test ไม่ได้ตรวจอะไร หรือโค้ดทำอยู่แล้ว — หาสาเหตุก่อนไปต่อ
2. **Green** — เขียนโค้ดเท่าที่ทำให้ test นี้ผ่าน ไม่เผื่อ test ถัดไป ไม่เพิ่ม feature ที่ยังไม่มีใครขอ แล้วรัน test **ทั้งชุด**
3. **Refactor** — ตอนที่ทุกตัวเขียว: ตั้งชื่อใหม่, ตัดซ้ำ, แยก function — รัน test ทั้งชุดหลังแก้ทุกครั้ง ถ้าแดงให้ย้อนการแก้นั้น ห้ามแก้ test เพื่อให้ refactor ผ่าน
4. กลับไปข้อ 1 กับพฤติกรรมถัดไป

**แก้บั๊ก:** เขียน test ที่ทำให้บั๊กเกิดซ้ำก่อน เห็นมัน fail แล้วค่อยแก้ — test ตัวนี้เก็บไว้กันบั๊กกลับมา

## 3. กฎ
- **ทีละ slice (vertical)** — test 1 ตัว → โค้ด 1 ส่วน → รอบถัดไป ไม่เขียน test ทั้งหมดก่อนแล้วค่อยเขียนโค้ด: test ที่เขียนรวดเดียวตรวจพฤติกรรมที่ *จินตนาการไว้* ไม่ใช่ที่เรียนรู้จากรอบก่อน
- **test ผ่าน public interface** — โค้ดข้างในเปลี่ยนได้ทั้งหมด test ไม่ควรต้องเปลี่ยน
- **ค่าที่คาดหวังมาจากแหล่งอิสระ** — ตัวเลขที่รู้ว่าถูก, ตัวอย่างจาก datasheet, ค่าที่วัดจากเครื่องจริง ไม่คำนวณด้วยสูตรเดียวกับโค้ด
- **ห้ามแตะเครื่องจริงในลูป** — test ห้ามเปิด serial port, ต่อ Modbus/PLC จริง, publish คำสั่งไปที่ driver จริง ทุกอย่างผ่าน fake (ดู [references/mocking.md](references/mocking.md))
- **ห้ามลดเกณฑ์ความปลอดภัยเพื่อให้ test ผ่าน** — timeout, limit, watchdog, interlock ถ้า test แดงเพราะค่าพวกนี้ ให้แก้โค้ดหรือถามผู้ใช้ ไม่แก้ค่า
- test ที่ใช้เวลา: inject นาฬิกา (`now()`) แทน `sleep` — test ต้องเร็วและผลเหมือนเดิมทุกครั้ง

## 4. Anti-patterns
- **ผูกกับ implementation** — mock class ของเราเอง, test private method, ตรวจผ่านช่องข้าง (อ่าน DB/ไฟล์/ตัวแปร global แทนที่จะถามผ่าน interface), นับว่า function ภายในถูกเรียกกี่ครั้ง — สังเกตได้จาก: refactor แล้ว test พังทั้งที่พฤติกรรมไม่เปลี่ยน
- **Tautological** — ค่าที่คาดหวังคำนวณแบบเดียวกับโค้ด (`EXPECT_EQ(scale(raw), raw * 0.1)`) ผ่านทุกครั้งโดยโครงสร้าง ไม่มีทางจับบั๊กได้ — พบบ่อยมากใน test ที่ AI เขียน
- **Horizontal slicing** — เขียน test ทุกตัวก่อน แล้วค่อยเขียนโค้ดทั้งหมด
- **test ที่ไม่มีวันแดง** — ไม่เคยเห็นมัน fail ก็ไม่รู้ว่ามันตรวจอะไรได้จริง

ตัวอย่าง test ที่ดี/ไม่ดีใน C++, Python, JS: [references/examples.md](references/examples.md)

## 5. รายงานผล
บอกผู้ใช้ว่าผ่านระดับไหน — TDD ให้แค่ระดับ **unit test** (บาง seam เป็น integration กับ fake) ไม่ใช่ simulator หรือ hardware
ระบุสิ่งที่ test ไม่ได้ครอบคลุม (จาก "จับอะไรไม่ได้" ในข้อ 1) และสิ่งที่ยังต้องลองกับเครื่องจริง
