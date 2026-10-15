# CHANGELOG — gppi

เวอร์ชันของทั้ง plugin (เลขใน `.claude-plugin/plugin.json`) — ทีมได้ของใหม่เมื่อเลขนี้เปลี่ยนเท่านั้น
การเปลี่ยนของ skill แต่ละตัวอยู่ใน `skills/<ชื่อ>/CHANGELOG.md`

## v0.1.7 — 2026-10-15
Tested: ตัวตรวจ CLAUDE.md กับสำเนาที่ทำให้เก่า 6 แบบ (จับได้ครบ), ตัวตรวจ flowchart กับ flowchart จริง 8 ไฟล์ของ fg-robot-pallet (อ่านอย่างเดียว), eval 17/17 (1 รอบต่อ case), ตัวกัน 23/23 — skill ใหม่ยังไม่ได้ใช้สร้าง CLAUDE.md ในโปรเจกต์จริง
- เพิ่ม: skill `project-claude-md` 1.1.0 — สร้าง/ตรวจ/อัปเดต CLAUDE.md ของโปรเจกต์คุมเครื่อง: ค่า hardware ชี้ไปไฟล์+key ไม่ copy ตัวเลข, จดสิ่งที่โค้ดไม่บอก (register ใครเขียน, อะไรทำให้เครื่องขยับ, เครื่องหน้างาน), ป้าย ✅/⚠️/❓, ตัวตรวจว่า CLAUDE.md ยังตรงกับโค้ด — **Claude จะถามก่อนสร้างเมื่อเปิดโปรเจกต์คุมเครื่องที่ไม่มี CLAUDE.md**; แนวคิดบางส่วนจาก anthropics/claude-plugins-official `claude-md-improver` (Apache-2.0)
- เปลี่ยน: `flowchart` 1.2.0 — ตัวตรวจเตือนน้อยลงมาก (ทดสอบกับ flowchart จริงของทีม: ~60 → 7 ข้อที่เป็นของจริง), ทำตามสไตล์ของทีม (REGISTER OWNERSHIP, กล่อง "ทำไม", LEGEND), ใช้โฟลเดอร์ flowchart เดิมของโปรเจกต์ (เช่น `docs/api/`)
- rules.md: เพิ่มแถว `project-claude-md` ในตาราง skill; ที่เก็บ flowchart ใช้ของเดิมของโปรเจกต์

## v0.1.6 — 2026-10-15
Tested: ตัวตรวจ flowchart กับไฟล์ที่ตั้งใจทำผิด (จับได้ครบ) + export ด้วย draw.io 31.7 ดูรูปแล้ว, ลองใช้ skill จริงกับ poll loop ของ Modbus, eval 15/15 (1 รอบต่อ case), ตัวกัน 23/23 — ยังไม่ได้ใช้ในโปรเจกต์จริง
- เพิ่ม (กฎใหม่ใน rules.md): **logic ที่มีลำดับหรือเงื่อนไข (state machine, sequence เครื่อง, start/stop/reset, alarm/interlock, retry/timeout) ต้องมี flowchart draw.io ที่ผู้ใช้ OK ก่อนเขียนโค้ด** — เก็บที่ `docs/flowcharts/<ชื่อ>.drawio` และ commit; แก้ logic ต้องแก้ flowchart ใน commit เดียวกัน; ไม่ต้องทำกับฟังก์ชันสั้นที่ไม่มีทางแยก หรือแก้บั๊กที่ไม่เปลี่ยน flow
- เพิ่ม: skill `flowchart` 1.1.0 — วิธีเขียน `.drawio` ที่ draw.io เปิดได้, สิ่งที่ flowchart ของเครื่องต้องมี (timeout ทุกการรอ, ทาง fault/STOP, ไม่เดินเองหลัง reset), ตัวตรวจ `tools/check_drawio.mjs` (ทางแยกขาด/ไม่มีป้าย, เส้นลอย, กล่องทับ, เส้นทับกล่อง/ตัดกัน, `--outline` อ่านไฟล์ที่ผู้ใช้แก้), ให้ draw.io จัดวางเองเมื่อเกิน ~15 กล่อง, ตัวอย่าง 2 ไฟล์ — แนวคิดบางส่วนจาก Agents365-ai/drawio-skill (MIT)
- `tdd` 1.1.1: ทุกทางออกของทางแยกใน flowchart = test; `git-commit` 1.3.1: เช็กว่าแก้ flowchart ตาม logic

## v0.1.5 — 2026-10-15
Tested: eval — แก้ layout แล้ว Claude เสนอ mockup และรอ OK (กรรมการ 3/3), แก้คำผิดไม่ต้องทำ mockup (กรรมการ 2/1); ตัวกัน 23/23 — ยังไม่ได้ลองในโปรเจกต์ UI จริง
- เพิ่ม (กฎใหม่ใน rules.md): **แก้ UI/UX ต้องทำ mockup เป็นไฟล์ HTML static ให้ผู้ใช้เปิดดูใน browser และรอ OK ก่อนแก้โค้ดจริง** — ข้อมูลปลอม ไม่ต่อเครื่อง; ยกเว้นแก้คำผิดหรือบั๊กที่ไม่เปลี่ยนหน้าตา
- `industrial-ui` 1.3.0: ขั้นตอนทำ mockup (`mockups/<ชื่อ>.html`, ขนาดจอจริง, ปุ่มสลับสถานะ, เทียบเก่า-ใหม่)

## v0.1.4 — 2026-10-14
Tested: unit test — gtest ของ template ROS2 16/16 + odometry 9/9 (g++ 11.4), client Modbus กับ libmodbus 3.1.6 + server จำลอง, ตัวกัน 23/23, eval การเลือก skill 12 case (1 รอบต่อ case) — **ตัวอย่าง C++ ใหม่ใน references ของ ROS2 ยังไม่ได้ build กับ ROS2 Humble จริง และยังไม่ได้ลองกับหุ่น/PLC/drive จริง**

ล้างเนื้อหาที่ผิดหรือล้าสมัย และเติมช่องว่าง (รีวิว [docs/reviews/2026-10-14-skills.md](docs/reviews/2026-10-14-skills.md) กลุ่ม 2–3):
- แก้: `ros2-humble-cpp` 3.4.1 — references ถูกต้องสำหรับ Humble (เดิมปน API ของ Jazzy ที่ build บน Humble ไม่ผ่าน); เพิ่ม deployment / runtime-provenance / system-diagnostics; **ตัวอย่าง systemd ปิด auto-restart ของ driver เป็นค่าเริ่มต้น** (watchdog kill ไม่ได้สั่งหยุดอุปกรณ์); เพิ่ม `references/odometry.md`; `ParameterDescriptor` สำหรับ parameter ด้านความปลอดภัย; คำสั่งที่ทำให้เครื่องขยับทำตาม rules.md ยกเว้น fault injection ทางกายภาพที่ผู้ใช้รันเองเท่านั้น
- เปลี่ยน: `modbus` 1.2.0 — เน้นหลักการที่ใช้ได้กับอุปกรณ์ทุกรุ่น + ขั้นตอนเจออุปกรณ์ใหม่ที่หน้างาน; `devices/` เป็นบันทึกรุ่นที่เคยใช้; pymodbus 3.13+, ASDA-B3 timeout
- แก้: `tdd` 1.1.0 — ตัวอย่าง `node --test test/` ใช้ไม่ได้บน Node 22/24 → `node --test`; Claude ไม่ restart Node-RED เอง; เพิ่ม property-based test
- เพิ่ม: `git-commit` 1.3.0 breaking change → major และเช็ก README/CLAUDE.md ก่อน commit; `project-readme` 1.1.0 template ภาษาไทย; `industrial-ui` 1.2.3 (rosbridge, Dashboard 2.0 v1.33, kiosk `/dashboard`); `opencv` 1.0.2 (BarcodeDetector 4.5 vs 4.8); `grilling` อัปเดตจากต้นทาง
- เพิ่ม: `evals/` วัดว่า Claude เลือก skill ถูก (`claude plugin eval`), `THIRD_PARTY_NOTICES.md`
- rules.md: แถว Modbus เป็น "อุปกรณ์ Modbus ทุกรุ่น"

## v0.1.3 — 2026-10-14
Tested: unit test — gtest 16/16 ของ template ROS2 (g++ 11.4 = Ubuntu 22.04), client Modbus กับ libmodbus 3.1.6 + Modbus server จำลองบน localhost, ตัวกัน 23/23, CI — **ยังไม่ได้ build template กับ ROS2 Humble จริง และยังไม่ได้ลองกับ PLC/drive จริง**

แก้จุดที่เสี่ยงต่อความปลอดภัยใน skill (จากการรีวิว [docs/reviews/2026-10-14-skills.md](docs/reviews/2026-10-14-skills.md)) — ใครที่ copy template ไปใช้แล้ว ควรเทียบกับรุ่นใหม่:
- แก้: `ros2-humble-cpp` 3.2.3 — template node ที่สั่งมอเตอร์:
  - watchdog เดิมใช้เวลาของ ROS — ตั้ง `use_sim_time:=true` บนเครื่องจริงแล้ว **watchdog ไม่ตัดเลย** → ใช้ steady clock
  - คำสั่ง NaN เดิมผ่านไปถึง hardware; dt ที่เป็น NaN ทำให้ **ramp กระโดดถึงความเร็วเป้าหมายทันที** → ชะลอหา 0
  - กลับทิศเดิมข้ามศูนย์ในรอบเดียว → หยุดที่ 0 หนึ่งรอบก่อน
  - parameter ผิด (NaN, ≤ 0, timeout สั้นกว่า 3 รอบ timer) → node ไม่ start
- แก้: `industrial-ui` 1.2.1 — HMI template เดิมขึ้น **"PLC เชื่อมต่อ" ทั้งที่ server หลุดจาก PLC**, แสดง RUNNING ค้างเมื่อข้อมูลหยุด, และ **ล็อกปุ่ม STOP** ระหว่างรอ ack
- แก้: `modbus` 1.1.1 — client C++ ไม่ตัดสายเมื่ออุปกรณ์ตอบ exception (เดิม reconnect วนทุกรอบ); ตัวอย่างที่เขียนค่ามีคำเตือนชัด; `mbpoll` RTU ต้องถามก่อนเปิด serial
- แก้: `safety-reviewer` 1.1.0 — **ไม่มี Bash แล้ว** (เดิมห้ามแค่ในข้อความ) + ตรวจเพิ่ม 6 เรื่อง (โหมดทดสอบค้างในของจริง, ขยับเองหลัง reset, overflow, race, QoS/ROS_DOMAIN_ID, safety function ย้ายไป software); `git-commit` 1.2.1 ส่ง diff ให้ผ่านไฟล์
- เพิ่ม: `tools/test-templates.sh` ทดสอบ template ที่คุม hardware (รันใน CI)

## v0.1.2 — 2026-10-14
Tested: unit test (23 pass), ตรวจลิงก์ในเอกสารและ skill — เปลี่ยนแค่เนื้อหา skill และเอกสาร ไม่แตะตัวกัน
- แก้: skill `ros2-humble-cpp` 3.2.2 — เลิกอ้างถึงไฟล์ `evidence-progression.md` ที่ไม่มีอยู่จริง (4 จุดในเรื่อง e-stop และการทดสอบ) Claude จะไม่ถูกพาไปหาไฟล์ที่ไม่มีอีก
- เอกสาร: README แยกตามคนอ่าน — เพิ่มหัวข้อ "ใช้งานประจำวัน" (เจอ prompt แล้วทำอะไร, `CLAUDE.md` ที่โปรเจกต์ต่อเครื่องจริงต้องมี); รายละเอียดตัวกันย้ายไป `docs/GUARD.md` เรื่องดูแล repo ย้ายไป `docs/MAINTAINING.md`

## v0.1.1 — 2026-10-14
Tested: unit test (23 pass) + ใช้งานจริงบน Windows 11 (VS Code, CLI) และ WSL Ubuntu 22.04 (CLI)
- แก้: คำสั่งที่ตัวกันถามขึ้นคำเตือน "gppi tried to reword a PreToolUse hook's ask" ทุกครั้ง — ตัวกันยังถามถูกต้องอยู่แล้ว แค่ไม่มีคำเตือนนี้อีก
- เพิ่ม: คู่มือติดตั้งทีละขั้น [docs/INSTALL.md](docs/INSTALL.md) ทั้ง Windows และ WSL พร้อมตารางปัญหาที่เจอบ่อย
- WSL ที่เคยใช้ installer ของ mskills: skill เก่าใน `~/.claude/skills` บัง skill ของ gppi — ดู INSTALL.md ส่วน WSL ขั้น 4

## v0.1.0 — 2026-10-14
Tested: unit test (22 pass, CI ผ่าน) + ใช้งานจริงบน Windows 11 (Claude Code 2.1.296 — VS Code extension และ CLI ใน mode ปกติ/auto/bypassPermissions) — **ยังไม่ได้ทดสอบบน WSL/Ubuntu**

รุ่นแรกของ gppi — แทน plugin `mskills` ทั้งชุด
- เพิ่ม: skill 9 ตัว (`ros2-humble-cpp` 3.2.1, `modbus` 1.1.0, `industrial-ui` 1.2.0, `opencv` 1.0.1, `project-readme` 1.0.0, `git-commit` 1.2.0, `tdd` 1.0.0, `grilling`, `domain-modeling`) และ agent `safety-reviewer` — เรียกเป็น `gppi:<ชื่อ>`
- เพิ่ม: กฎการทำงานทุกโปรเจกต์ (`rules.md`) ส่งเข้าทุก session อัตโนมัติ แทน `~/.claude/CLAUDE.md` ส่วนกลางเดิม
- เพิ่ม: ตัวกันที่ **หยุดถามก่อนรัน** คำสั่งที่อาจทำให้เครื่องจักรขยับหรือแย่ง bus (ROS2 pub/launch/run, service/pm2/docker, Modbus/serial, Node-RED deploy/inject/runtime, python ที่สั่ง bus, ปิดเครื่อง/หยุด process, COM port) และคำสั่ง git ที่ย้อนกลับยาก — ถามได้แม้ใน auto mode และ bypassPermissions; รายการเต็มและสิ่งที่ไม่จับอยู่ใน README หัวข้อ "ความปลอดภัย"

⚠ ติดตั้ง (ทำทั้งฝั่ง Windows และ WSL ถ้าใช้ทั้งคู่):
1. ต้องมี Claude Code ≥ 2.1.287, **node ≥ 22.18** และบน Windows ต้องมี Git for Windows — ไม่มี node ตัวกันจะบล็อกคำสั่ง shell ทุกตัว (ตั้งใจ)
2. เครื่องที่ใช้ mskills: `claude plugin uninstall mskills@mskills` แล้ว `claude plugin marketplace remove mskills`
3. ติดตั้งตาม README หัวข้อ "ติดตั้ง" และเปิด auto-update ของ marketplace `gppi`
4. ตรวจ: สั่ง `รัน ros2 topic pub /test std_msgs/msg/String "{}"` ต้องถาม → กด No
