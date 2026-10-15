# กฎการทำงานทุกโปรเจกต์

กฎนี้มาจาก plugin `gppi` (ไฟล์ `rules.md` ใน repo gppi) — แก้ที่ repo, commit, push แล้วอัปเดต plugin; ไม่แก้สำเนาใน cache
ถ้าโปรเจกต์มี `CLAUDE.md` ของตัวเอง และขัดกับไฟล์นี้ ให้ยึดของโปรเจกต์

## ใช้ skill ตามงาน
ก่อนเริ่มงานที่ตรงกับรายการนี้ ให้โหลด skill นั้นก่อนเสมอ แม้ผู้ใช้จะไม่ได้สั่ง — ถ้า skill ยังไม่ได้ติดตั้งในเครื่อง/โปรเจกต์นี้ ให้บอกผู้ใช้

| งาน | skill |
|---|---|
| ROS2 (node, package, launch, colcon, QoS, odometry, bringup) | `ros2-humble-cpp` |
| Modbus RTU/TCP, PLC, register, RS-485, อุปกรณ์ Modbus ทุกรุ่น (เช่น FX5, ASDA-B3, JY-ME02, ME231) | `modbus` |
| กล้อง/งานภาพ: OpenCV, นับ/ตรวจชิ้นงาน, วัดขนาด, หาตำแหน่งให้ robot, QR/barcode, camera calibration | `opencv` |
| หน้าจอ HMI, dashboard, หน้า config, Node-RED Dashboard, Grafana, Web UI ↔ ROS2 | `industrial-ui` |
| เขียน/แก้/ตรวจ README, หรือแก้โค้ดที่ทำให้สิ่งที่ README อธิบายไว้เปลี่ยน | `project-readme` |
| สร้าง/อัปเดต CLAUDE.md ของโปรเจกต์, ตั้งต้นโปรเจกต์ใหม่ — และเมื่อโปรเจกต์คุมเครื่อง (Modbus/PLC/serial/ROS2 driver/Node-RED ที่สั่งอุปกรณ์) ยังไม่มี CLAUDE.md | `project-claude-md` (ถามผู้ใช้ก่อนสร้าง) |
| commit, release / ออกเวอร์ชัน, tag | `git-commit` |
| เขียน/แก้ logic ที่มีลำดับหรือเงื่อนไข (state machine, sequence เครื่อง, start/stop/reset, alarm/interlock, retry/timeout), flowchart, draw.io | `flowchart` |
| เขียน logic ใหม่หรือแก้บั๊กที่ test ได้ (แปลงค่า register/scale, คำนวณ, state machine, parser, alarm/interlock, timeout) | `tdd` (ถามก่อนถ้าไม่แน่ใจว่าคุ้มทำแบบ TDD) |
| วางแผน/ออกแบบสิ่งใหม่ที่ยังมีเรื่องต้องตัดสินใจหลายข้อ | `grilling` (ถามผู้ใช้ก่อนว่าจะให้ grill ไหม) |
| การตัดสินใจที่ย้อนกลับยาก + คนอ่านทีหลังจะสงสัย + มีทางเลือกจริง | `domain-modeling` (เสนอจด ADR) |

งานหนึ่งอาจใช้หลาย skill พร้อมกัน (เช่น bridge ROS2 → PLC = `ros2-humble-cpp` + `modbus`; แก้ฟังก์ชันแปลงค่า register = `modbus` + `tdd`; sequence ของเครื่อง = `flowchart` ก่อน แล้ว `tdd`) — skill ความรู้ของอุปกรณ์/งานไม่แทน `tdd` ให้โหลดครบทุกตัวที่ตรงก่อนเริ่ม
บอกผู้ใช้สั้นๆ ตอนเริ่มงานว่าใช้ skill อะไร

## กฎที่ใช้เสมอ
- **ห้ามเดาค่า hardware** (address, slave ID, IP, scale, wheelbase, หน่วย) — หาในโค้ด/CLAUDE.md/datasheet ก่อน ไม่มีให้ถาม — เพราะค่าผิดจะอ่าน/เขียนอุปกรณ์ผิดตัวหรือผิดหน่วยโดยไม่มี error เตือน
- **ROS2 topic เป็น local เท่านั้น** — `ROS_LOCALHOST_ONLY=1` + `ROS_DOMAIN_ID` ตาม CLAUDE.md ของโปรเจกต์; เปิดข้ามเครื่องเฉพาะเมื่อ CLAUDE.md ของโปรเจกต์บอก — เพราะ DDS ที่ออก LAN จะเห็น/ชนกับ ROS2 ของเครื่องอื่น และให้ใครก็ได้ใน network สั่ง topic ได้ (Modbus TCP ไป PLC ไม่เกี่ยวกับค่านี้ ใช้ LAN ได้ตามปกติ)
- **ห้ามรันคำสั่งที่อาจทำให้เครื่องจักรขยับ** ถ้าผู้ใช้ไม่ได้สั่งชัดเจนในข้อความนั้น — รวมถึง: เขียน Modbus register/coil, `ros2 topic pub`/`service call`/`action send_goal` ไปที่ driver, `ros2 launch` ที่มี driver ของจริง, deploy Node-RED flow, restart service ที่คุมเครื่อง (`systemctl`, `pm2`) — คำสั่งอ่านอย่างเดียว (`ros2 topic echo`, ดู log) ทำได้ แต่เปิด serial/RS-485 ที่ระบบใช้อยู่ให้ถามก่อน (ชนกับ master ตัวเดิมบน bus); ไม่แน่ใจให้ถามก่อน
  - plugin gppi มีตัวกัน (`hooks/gppi.ts`) ที่หยุดถามก่อนรันคำสั่งพวกนี้ใน Bash/PowerShell — แต่จับได้เฉพาะคำสั่ง shell ที่เห็นชัด ไม่จับ script ที่สั่งเครื่องจากข้างใน (python/node ที่เขียน register) — กฎข้อนี้จึงยังใช้เต็มที่ ไม่ใช่ปล่อยให้ตัวกันจับแทน
  - **MCP tool ก็นับ** — ตัวกันไม่เห็น MCP เลย: ห้ามเรียก MCP tool ที่เขียนค่า/สั่งอุปกรณ์ (เขียน register, publish/service/action ไปที่ driver, deploy flow) ถ้าผู้ใช้ไม่ได้สั่งชัดเจน; MCP ที่แตะเครื่องต้องเปิดเป็นรายโปรเจกต์ใน `.mcp.json` แบบอ่านอย่างเดียว + deny tool ที่เขียนได้ ไม่ใส่ใน plugin หรือ user scope (template: `project-setup/mcp/` ใน repo gppi)
- **ห้ามลดเกณฑ์ความปลอดภัย** (timeout, limit, watchdog, interlock) เพื่อให้ test ผ่าน — เพราะค่าที่หลวมลงจะไปถึงเครื่องหน้างานด้วย; test แดงให้แก้โค้ดหรือถามผู้ใช้
- **รายงานระดับการทดสอบให้ชัด**: build / unit test / simulator / hardware ไม่มีโหลด / ใช้งานจริง
- **แก้โค้ดที่เปลี่ยนพฤติกรรม → อัปเดต README และ CLAUDE.md ของโปรเจกต์ในงานเดียวกัน**
- **logic ที่มีลำดับหรือเงื่อนไขต้องมี flowchart draw.io ที่ผู้ใช้ OK ก่อนเขียนโค้ด** — state machine, sequence ของเครื่อง, start/stop/reset, alarm/interlock, retry/timeout, flow หลายทางแยก — เก็บที่ที่โปรเจกต์เก็บ flowchart อยู่แล้ว (ไม่มีให้ใช้ `docs/flowcharts/<ชื่อ>.drawio`) และ commit; แก้ logic → แก้ flowchart ใน commit เดียวกัน; โค้ดกับรูปไม่ตรงกัน → ถามผู้ใช้ว่าอันไหนถูก (วิธีทำอยู่ใน skill `flowchart`) — ไม่ต้องทำ: ฟังก์ชันสั้นที่ไม่มีทางแยก (แปลงค่า, สูตร), แก้บั๊กที่ไม่เปลี่ยน flow — เพราะผู้ใช้กับ Claude ต้องเห็น flow เดียวกันก่อน โดยเฉพาะทาง timeout/หยุดเครื่องที่หลุดง่ายเมื่ออ่านแต่โค้ด
- **แก้ UI/UX ต้องทำ mockup ให้ผู้ใช้ดูและรอ OK ก่อนแก้โค้ดจริง** — ครอบคลุมหน้าจอใหม่, layout, ปุ่ม, สี, ขนาด, flow การกด/ยืนยัน ไม่ว่าจะโหลด skill `industrial-ui` หรือไม่ (วิธีทำ mockup อยู่ใน skill นั้น) — mockup เป็นไฟล์ HTML แบบ static ที่ผู้ใช้เปิดใน browser ได้ ใช้ข้อมูลปลอม และไม่ต่อ PLC/ROS2/Node-RED/WebSocket ใดๆ — ไม่ต้องทำเมื่อแก้แค่คำผิดในข้อความบนจอ หรือแก้บั๊กที่ไม่เปลี่ยนหน้าตา; ไม่แน่ใจว่าเปลี่ยนหน้าตาไหมให้ถามก่อน — เพราะหน้าจอที่ operator ใช้คุมเครื่อง ถ้าออกมาไม่ตรงที่คิด ต้องแก้ซ้ำหลายรอบ และปุ่มที่ย้ายที่อาจทำให้กดผิดหน้างาน
- อธิบายเป็นภาษาไทย ใช้ศัพท์เทคนิคเป็นภาษาอังกฤษ; เอกสารในโปรเจกต์ใช้ภาษาเดียวกับเอกสารเดิม

## เครื่องที่ใช้
- dev: Windows 11 + WSL Ubuntu 22.04 (ROS2 Humble) / runtime: mini PC Ubuntu 22.04 — ไม่รัน ROS2 บน Windows
- โค้ดทำงานร่วมกับทีมบน GitLab
- skill ทั้งหมดเก็บใน repo `gppi` บน GitHub (private) — แก้ผ่าน issue/PR ที่ repo นั้น ไม่แก้สำเนาใน `~/.claude/skills`, cache ของ plugin (`~/.claude/plugins/`) หรือในโปรเจกต์ (skill ที่มีไฟล์ `LICENSE` ของตัวเอง เช่น `grilling`, `domain-modeling` มาจากภายนอก ห้ามแก้เนื้อหา — อัปเดตด้วยการ copy จากต้นทางใหม่ทั้งไฟล์)
