# gppi

**G**ot **P**atipan **p**lugin — plugin ของทีมสำหรับ Claude Code ใช้กับงานเครื่องจักร, robot และ IoT ติดตั้งครั้งเดียวแล้ว Claude จะมีความรู้งานของเรา (ROS2 Humble, Modbus, OpenCV, HMI), ทำตามกฎการทำงานของทีมทุก session, **หยุดถามก่อนรันคำสั่งที่อาจทำให้เครื่องจักรขยับ** และตรวจโค้ดก่อน commit — เวอร์ชันใหม่มาถึงเครื่องทุกคนเองเมื่อเจ้าของ repo ออก release

> [!IMPORTANT]
> - ใช้ได้เฉพาะ **Claude Code** (VS Code, CLI, JetBrains) ที่ติดตั้ง gppi แล้ว — แชทบน claude.ai, claude.ai/code และ Desktop ที่เปิดแบบ WSL **ไม่มีตัวกัน** ห้ามใช้ที่เหล่านั้นกับงานที่ต่อเครื่องจริง
> - ตัวกันไม่ได้จับได้ทุกคำสั่ง — **อ่านคำสั่งก่อนกด Yes ทุกครั้ง** ([สิ่งที่ไม่จับ](docs/GUARD.md#สิ่งที่ไม่จับ))

## ได้อะไรบ้าง
- **skill 9 ตัว** — ความรู้งานของทีม Claude โหลดเองเมื่องานตรง (ดู [ตาราง skill](#skill-และ-subagent))
- **กฎการทำงาน** — ส่งเข้าทุก session อัตโนมัติ: ห้ามเดาค่า hardware, ROS2 แบบ local เท่านั้น, ห้ามสั่งเครื่องขยับถ้าไม่ได้สั่งชัด, ห้ามลดเกณฑ์ความปลอดภัยเพื่อให้ test ผ่าน, รายงานให้ชัดว่าทดสอบถึงระดับไหน — อ่านทั้งหมดใน [`rules.md`](rules.md)
- **ตัวกันคำสั่ง** — หยุดให้คนยืนยันก่อนรันคำสั่ง ROS2 ที่สั่ง driver, restart service, เปิด Modbus/serial, deploy Node-RED, ปิดเครื่อง, git push ฯลฯ (ดู [ความปลอดภัย](#ความปลอดภัย))
- **ตัวตรวจก่อน commit** — `gppi:safety-reviewer` อ่าน diff แบบคนนอก หาเกณฑ์ความปลอดภัยที่ถูกลดและค่า hardware ที่เปลี่ยน

## ติดตั้ง
**ทำตาม [docs/INSTALL.md](docs/INSTALL.md)** — ทีละขั้นตั้งแต่เครื่องเปล่า ทั้ง Windows และ WSL พร้อมตารางปัญหาที่เจอบ่อย

ต้องมี (ทุกฝั่งที่ใช้ Claude Code — Windows กับ WSL แยกกัน):

| | |
|---|---|
| Claude Code | 2.1.287 ขึ้นไป |
| node | 22.18 ขึ้นไป — **ไม่มี Claude จะรันคำสั่ง shell ไม่ได้เลย** (ตั้งใจ ให้รู้ตั้งแต่วันแรกว่าเครื่องยังไม่พร้อม) |
| Windows | Git for Windows |
| สิทธิ์ | เป็น collaborator ของ repo นี้ (private) |

เครื่องที่พร้อมแล้ว:
```bash
claude plugin marketplace add GotPatipan39/gppi
claude plugin install gppi@gppi
```
แล้วเปิด auto-update (`/plugin` → Marketplaces → `gppi` → Enable auto-update — **ปิดอยู่เป็นค่าเริ่มต้น**) และเปิดแชทใหม่

## ใช้งานประจำวัน
- **สั่งงานตามปกติ** — Claude เลือก skill เองแล้วบอกว่าใช้ตัวไหน; เรียกเองก็ได้ เช่น `/gppi:modbus`, `/gppi:tdd`
- **เจอ prompt "Do you want to proceed?"** — แปลว่าคำสั่งนั้นอาจแตะเครื่องจริง:
  - อ่านคำสั่งให้จบ ถ้าต่อเครื่องจริง เช็กว่าเครื่องอยู่ในสภาพพร้อมและไม่มีคนอยู่ในระยะ
  - ตัวเลือกเริ่มต้นคือ **"1. Yes"** — กด Enter ครั้งเดียว = อนุญาต
  - ไม่แน่ใจ → กด **No** แล้วถาม Claude ว่าคำสั่งนี้จะทำอะไร
- **โปรเจกต์ที่ต่อเครื่องจริง ต้องมี `CLAUDE.md` ที่ root** — กฎของ gppi ห้าม Claude เดาค่า hardware ถ้าไม่มีข้อมูล Claude จะหยุดถามทุกครั้ง ใส่ค่าที่ Claude ต้องใช้ไว้ครั้งเดียว:
  ```markdown
  # <ชื่อโปรเจกต์>
  ## Hardware
  | อุปกรณ์ | การต่อ | ค่า |
  |---|---|---|
  | <PLC รุ่น> | Modbus TCP | IP `<ip>`, port `<port>`, slave ID `<id>` |
  ## ROS2
  - `ROS_DOMAIN_ID=<เลข>`, `ROS_LOCALHOST_ONLY=1`
  ## ห้าม
  - <สิ่งที่ห้ามทำกับเครื่องนี้ เช่น ห้ามเขียน register ช่วง D1000–D1999>
  ```
  ถ้า `CLAUDE.md` ของโปรเจกต์ขัดกับกฎของ gppi Claude จะยึดของโปรเจกต์
- **commit** — สั่ง "commit" แล้ว skill `git-commit` จะเขียน message ให้ และในโปรเจกต์ที่คุมเครื่องจะให้ `safety-reviewer` ตรวจก่อน — เจอ 🔴 จะหยุดรอคุณตัดสิน
- **อัปเดต** — อัตโนมัติ มีผลในแชทถัดไป เช็กรุ่นด้วย `claude plugin list`
- **อย่า copy skill ของ gppi ไปที่อื่น** — ไว้ใน `~/.claude/skills/` จะบังตัวใน plugin โดยไม่มีคำเตือนและไม่อัปเดตตาม; อัปโหลดขึ้น claude.ai ก็จะค้างเป็นเนื้อหาเก่า

## ความปลอดภัย
> [!WARNING]
> ตัวกันเป็นแค่ด่านหนึ่ง — ไม่จับ wrapper script (`./bringup.sh`, `make run`) และโค้ดใน script ที่สั่งเครื่องเอง (`python write_plc.py`) คนต้องอ่านคำสั่งก่อนกดยืนยันเสมอ

ก่อน Claude รันคำสั่งใน Bash หรือ PowerShell ตัวกันจะ **หยุดถาม** ถ้าคำสั่งเข้ากลุ่มเหล่านี้:

| กลุ่ม | ตัวอย่าง |
|---|---|
| ROS2 ที่สั่ง driver / เปิด node | `ros2 topic pub`, `ros2 launch`, `ros2 run`, `ros2 param set`, `ros2 bag play` |
| restart service | `systemctl restart`, `pm2 restart`, `docker compose up` |
| เปิด Modbus / serial | `mbpoll`, `minicom`, คำสั่งที่แตะ `/dev/ttyUSB0` หรือ `/dev/<ชื่อ udev>` |
| Node-RED | deploy flow, กด inject, เปิด runtime |
| python ที่มีโค้ด Modbus ในบรรทัดคำสั่ง | `python -c "...pymodbus..."` |
| หยุด process / ปิดเครื่อง | `pkill`, `reboot`, `shutdown`, `wsl --shutdown`, `taskkill` |
| COM port ฝั่ง Windows | `usbipd attach`, `mode COM3` |
| git ที่ย้อนกลับยาก | `git push`, `git reset --hard`, `git clean` |

ตั้งใจให้เป็นแบบนี้:
- **ถาม ไม่บล็อก** — งานทดสอบหน้างานต้องรันคำสั่งพวกนี้จริง
- **ไม่ยกเว้นงาน simulator** — จากคำสั่งแยกไม่ออกว่า `ros2 launch` ต่อ driver จริงหรือไม่
- **เปิด bus = ถาม แม้แค่อ่าน** — เปิด RS-485 ที่ระบบใช้อยู่จะชนกับ master ตัวเดิม
- **ถามได้ในทุก permission mode** ที่ทดสอบ รวม auto (ค่าเริ่มต้นของ CLI) และ bypassPermissions
- **ใน VS Code จะไม่เห็นข้อความเหตุผล "gppi: ..."** — CLI เห็น

รายการคำสั่งทั้งหมด, สิ่งที่ไม่จับ และวิธีทำงานข้างใน: [docs/GUARD.md](docs/GUARD.md)

## skill และ subagent
| skill | เวอร์ชัน | ใช้กับ |
|---|---|---|
| `ros2-humble-cpp` | 3.3.0 | งาน ROS2 Humble + C++ |
| `modbus` | 1.1.2 | งาน Modbus RTU/TCP ทุกแบบ (C++, Node-RED, Python) |
| `industrial-ui` | 1.2.3 | UI/UX งานอุตสาหกรรม: HMI, dashboard, หน้า config (Web, Node-RED Dashboard, Grafana) |
| `opencv` | 1.0.2 | machine vision ด้วย OpenCV (Python/C++, ROS2 node หรือโปรแกรมแยก): นับ/ตรวจชิ้นงาน, วัดขนาด, หาตำแหน่งให้ robot, QR/barcode, กล้อง UVC/industrial/depth/RTSP |
| `project-readme` | 1.0.1 | เขียน/ปรับ README ของโปรเจกต์ให้ทีมอ่านเข้าใจ |
| `git-commit` | 1.3.0 | commit message (Conventional Commits + body อธิบายเหตุผล), ตรวจของที่ห้าม commit, release + CHANGELOG + tag |
| `tdd` | 1.1.0 | เขียน logic/แก้บั๊กแบบ test ก่อน (red → green → refactor) ทุกภาษา, mock ที่ขอบ hardware |
| `grilling` | ภายนอก | ซักถามแผนงาน/การออกแบบทีละรอบจนไม่มีอะไรค้าง |
| `domain-modeling` | ภายนอก | จดศัพท์โปรเจกต์ (`GLOSSARY.md`) และการตัดสินใจสำคัญ (`docs/adr/`) |

`grilling` และ `domain-modeling` มาจาก mattpocock/skills (MIT) @ 49dd158 (2026-10-09) แบบไม่แก้เนื้อหา — ไฟล์ `LICENSE` อยู่ในโฟลเดอร์ของแต่ละตัว ส่วนที่ดัดแปลงจากภายนอก (`tdd`, `git-commit`, reference บางส่วนของ ROS2 และ industrial-ui) ดู [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)

| subagent | เวอร์ชัน | ใช้กับ | เรียกอย่างไร |
|---|---|---|---|
| `safety-reviewer` | 1.1.0 | ตรวจ diff ก่อน commit ในโปรเจกต์ที่คุมเครื่องจักร: เกณฑ์ความปลอดภัยที่ถูกลด, ค่า hardware ที่เปลี่ยน, คำสั่งขยับที่ไม่มีเงื่อนไข, ตอนสื่อสารล้มเหลว, test ที่ถูกแก้ให้ผ่าน, โหมดทดสอบที่ค้างในของจริง, การขยับเองหลัง reset — **ไม่มี Bash** (รันคำสั่งไม่ได้เลย อ่าน diff จากไฟล์ที่ผู้เรียกเขียนให้) | skill `git-commit` เรียกให้เอง หรือสั่ง "ให้ safety-reviewer ตรวจ" — ชื่อเต็มคือ `gppi:safety-reviewer` |

## โครงสร้าง
```
gppi/
├── .claude-plugin/   ← plugin.json (ชื่อ + เวอร์ชัน) + marketplace.json
├── skills/<ชื่อ>/    ← skill ทั้งหมด (มีไฟล์ LICENSE = มาจากภายนอก ห้ามแก้เนื้อหา)
├── agents/           ← subagent
├── hooks/            ← ตัวกันคำสั่ง + ส่งกฎเข้า session
├── rules.md          ← กฎการทำงานที่ Claude อ่านทุก session
├── templates/        ← ตัวอย่าง config ให้ copy ไปใช้ในโปรเจกต์
├── docs/             ← INSTALL, GUARD, MAINTAINING, ADR, ผลทดสอบ
├── THIRD_PARTY_NOTICES.md ← license ของส่วนที่ดัดแปลงจากภายนอก
└── CHANGELOG.md      ← อะไรเปลี่ยนในแต่ละเวอร์ชัน
```

## ดูแลและพัฒนา
แก้ skill, ทดสอบ, ออกเวอร์ชัน, รับ skill จากภายนอก และการตัดสินใจที่ผ่านมา: [docs/MAINTAINING.md](docs/MAINTAINING.md)
