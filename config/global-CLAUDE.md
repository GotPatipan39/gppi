# กฎการทำงานทุกโปรเจกต์

ไฟล์นี้ติดตั้งจาก `config/global-CLAUDE.md` ใน repo mskills (เครื่องนี้: `{{SKILLS_DIR}}`) — แก้ที่ต้นฉบับ commit แล้วติดตั้งใหม่ ไม่แก้ที่ปลายทาง
ถ้าโปรเจกต์มี `CLAUDE.md` ของตัวเอง และขัดกับไฟล์นี้ ให้ยึดของโปรเจกต์

## ใช้ skill ตามงาน
ก่อนเริ่มงานที่ตรงกับรายการนี้ ให้โหลด skill นั้นก่อนเสมอ แม้ผู้ใช้จะไม่ได้สั่ง — ถ้า skill ยังไม่ได้ติดตั้งในเครื่อง/โปรเจกต์นี้ ให้บอกผู้ใช้

| งาน | skill |
|---|---|
| ROS2 (node, package, launch, colcon, QoS, odometry, bringup) | `ros2-humble-cpp` |
| Modbus RTU/TCP, PLC, register, RS-485, อุปกรณ์ (FX5, ASDA-B3, JY-ME02, ME231) | `modbus` |
| หน้าจอ HMI, dashboard, หน้า config, Node-RED Dashboard, Grafana, Web UI ↔ ROS2 | `industrial-ui` |
| เขียน/แก้/ตรวจ README, หรือแก้โค้ดที่ทำให้สิ่งที่ README อธิบายไว้เปลี่ยน | `project-readme` |
| commit, release / ออกเวอร์ชัน, tag | `git-commit` |
| เขียน logic ใหม่หรือแก้บั๊กที่ test ได้ (แปลงค่า register/scale, คำนวณ, state machine, parser, alarm/interlock, timeout) | `tdd` (ถามก่อนถ้าไม่แน่ใจว่าคุ้มทำแบบ TDD) |
| วางแผน/ออกแบบสิ่งใหม่ที่ยังมีเรื่องต้องตัดสินใจหลายข้อ | `grilling` (ถามผู้ใช้ก่อนว่าจะให้ grill ไหม) |
| การตัดสินใจที่ย้อนกลับยาก + คนอ่านทีหลังจะสงสัย + มีทางเลือกจริง | `domain-modeling` (เสนอจด ADR) |

งานหนึ่งอาจใช้หลาย skill พร้อมกัน (เช่น bridge ROS2 → PLC = `ros2-humble-cpp` + `modbus`)
บอกผู้ใช้สั้นๆ ตอนเริ่มงานว่าใช้ skill อะไร

## กฎที่ใช้เสมอ
- **ห้ามเดาค่า hardware** (address, slave ID, IP, scale, wheelbase, หน่วย) — หาในโค้ด/CLAUDE.md/datasheet ก่อน ไม่มีให้ถาม — เพราะค่าผิดจะอ่าน/เขียนอุปกรณ์ผิดตัวหรือผิดหน่วยโดยไม่มี error เตือน
- **local เท่านั้นตอน runtime** — ระบบที่หน้างานต้องทำงานได้โดยไม่พึ่ง internet/cloud, ไม่โหลด font/JS/CSS จาก CDN — เพราะเครื่องหน้างานมักไม่มี internet; ตอน dev ใช้ internet ได้ (ติดตั้ง package, อ่าน docs)
- **ห้ามรันคำสั่งที่อาจทำให้เครื่องจักรขยับ** ถ้าผู้ใช้ไม่ได้สั่งชัดเจนในข้อความนั้น — รวมถึง: เขียน Modbus register/coil, `ros2 topic pub`/`service call`/`action send_goal` ไปที่ driver, `ros2 launch` ที่มี driver ของจริง, deploy Node-RED flow, restart service ที่คุมเครื่อง (`systemctl`, `pm2`) — คำสั่งอ่านอย่างเดียว (`ros2 topic echo`, ดู log) ทำได้ แต่เปิด serial/RS-485 ที่ระบบใช้อยู่ให้ถามก่อน (ชนกับ master ตัวเดิมบน bus); ไม่แน่ใจให้ถามก่อน
- **ห้ามลดเกณฑ์ความปลอดภัย** (timeout, limit, watchdog, interlock) เพื่อให้ test ผ่าน — เพราะค่าที่หลวมลงจะไปถึงเครื่องหน้างานด้วย; test แดงให้แก้โค้ดหรือถามผู้ใช้
- **รายงานระดับการทดสอบให้ชัด**: build / unit test / simulator / hardware ไม่มีโหลด / ใช้งานจริง
- **แก้โค้ดที่เปลี่ยนพฤติกรรม → อัปเดต README และ CLAUDE.md ของโปรเจกต์ในงานเดียวกัน**
- อธิบายเป็นภาษาไทย ใช้ศัพท์เทคนิคเป็นภาษาอังกฤษ; เอกสารในโปรเจกต์ใช้ภาษาเดียวกับเอกสารเดิม

## เครื่องที่ใช้
- dev: Windows 11 + WSL Ubuntu 22.04 (ROS2 Humble) / runtime: mini PC Ubuntu 22.04 — ไม่รัน ROS2 บน Windows
- โค้ดทำงานร่วมกับทีมบน GitLab
- skill ทั้งหมดเก็บใน repo `mskills` บน GitHub (private) — เครื่องนี้อยู่ที่ `{{SKILLS_DIR}}`; ถ้าแก้ skill ให้แก้ที่นั่น ไม่แก้สำเนาใน `~/.claude/skills` หรือในโปรเจกต์ (skill ของเราอยู่ใน `skills/`; ใน `vendor/` เป็นของภายนอก ห้ามแก้เนื้อหา)
