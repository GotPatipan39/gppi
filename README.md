# gppi

**G**ot **P**atipan **p**lugin — Claude Code plugin ของทีมสำหรับงานเครื่องจักร, robot และ IoT รวม skill (ROS2 Humble, Modbus, OpenCV, industrial UI, TDD, commit, README), subagent `safety-reviewer`, กฎการทำงานทุกโปรเจกต์ และตัวกันที่ให้ Claude ถามก่อนรันคำสั่งที่อาจทำให้เครื่องจักรขยับ — ติดตั้งครั้งเดียวแล้วได้ทั้งชุด อัปเดตจาก repo นี้ที่เดียว

> [!IMPORTANT]
> ตัวกันคำสั่งทำงานเฉพาะใน Claude Code (CLI, VS Code, JetBrains, Desktop แบบ Windows) ที่ติดตั้ง gppi แล้ว — **Desktop ที่เปิด session แบบ WSL, claude.ai/code (cloud) และแชทบน claude.ai ไม่มีตัวกัน** ห้ามใช้ที่เหล่านั้นกับงานที่ต่อเครื่องจริง — และต้องมี **node 22.18 ขึ้นไป** ทุกเครื่อง ไม่อย่างนั้น Claude จะรันคำสั่ง shell ไม่ได้เลย (ตั้งใจ ดู [ติดตั้ง](#ติดตั้ง)) ดู [ความปลอดภัย](#ความปลอดภัย)

## ความปลอดภัย
gppi มีสามชั้นที่ช่วยกัน ไม่มีชั้นไหนจับได้ครบเพียงชั้นเดียว:

| ชั้น | อยู่ที่ | ทำอะไร |
|---|---|---|
| กฎ | [`rules.md`](rules.md) ฉีดเข้าทุก session ผ่าน hook `SessionStart` | ห้ามรันคำสั่งที่ทำให้เครื่องขยับถ้าผู้ใช้ไม่ได้สั่ง, ห้ามเดาค่า hardware, ห้ามลดเกณฑ์ความปลอดภัยเพื่อให้ test ผ่าน, ROS2 local เท่านั้น |
| ตัวกันคำสั่ง | [`hooks/gppi.ts`](hooks/gppi.ts) ผ่านสองทาง: PreToolUse hook ([`hooks/pretooluse.ts`](hooks/pretooluse.ts), รันด้วย node) และ mod (`tool.check`) | หยุด **ถาม** ก่อนรันคำสั่งในรายการข้างล่าง ทั้ง Bash และ PowerShell — ถามทับ `allow` rule ที่ตั้งเองด้วย; hook ทำให้ถามได้แม้ใน auto mode ([ADR-0003](docs/adr/0003-guard-hook-plus-mod.md)) |
| ตัวตรวจ diff | [`agents/safety-reviewer.md`](agents/safety-reviewer.md) | skill `git-commit` เรียกให้ตรวจก่อน commit ในโปรเจกต์ที่คุมเครื่อง |

คำสั่งที่ตัวกันถามก่อนรัน:
- **ROS2**: `topic pub`, `service call`, `action send_goal`, `launch`, `run`, `param set/load`, `lifecycle set`, `control switch_controllers/set_controller_state/load_controller`, `bag play`, `component load`
- **service**: `systemctl start/stop/restart/reload/kill/isolate`, `enable/disable/mask --now`, `service ... restart`, `pm2 start/stop/restart/reload/delete/resurrect`, `pm2-runtime`
- **bus**: `mbpoll`, `modpoll`, serial terminal (`minicom`, `picocom`, `tio`, `miniterm`, ...) และคำสั่งใดก็ตามที่แตะ `/dev/<device>` ที่ไม่ใช่ device ทั่วไป (`null`, กล้อง, disk) — รวม symlink ของ udev อย่าง `/dev/motor_controller`; ยกเว้น `ls`, `udevadm`, `dmesg`, `stat`, `readlink`, `test`
- **Node-RED**: deploy flow (POST/PUT ไปที่ `/flow(s)`), กด inject (`/inject/<id>`), เปิด runtime (`node-red`, `npx node-red`, `node-red-start/restart/stop`)
- **container** (docker, podman, nerdctl): `compose up/start/restart/stop/down/kill/run`, `run/start/restart/stop/kill/pause`, `rm -f` — ดู `ps/logs/exec/build` ไม่ถาม
- **python ที่สั่ง bus ในบรรทัดคำสั่ง** (`python`/`py` ที่มีโค้ดอยู่ในคำสั่งเอง: `-c`, heredoc, pipe): `pymodbus`, `minimalmodbus`, `pyModbusTCP`, `Serial(`, `write_register/coil`
- **หยุด process / เครื่อง**: `pkill`, `killall`, `reboot`, `shutdown`, `poweroff`, `halt`, `init 0/6`, `systemctl reboot/poweroff`, `wsl --shutdown/-t` และฝั่ง Windows `taskkill`, `Stop-Process`, `Start/Stop/Restart-Service`, `sc`/`nssm stop/start/restart`, `Restart/Stop-Computer` — driver ที่หยุดกลางคำสั่งโดยไม่มี watchdog ทำให้เครื่องค้างค่าสุดท้าย (`kill <pid>` ไม่ถาม)
  - คำที่เป็นภาษาธรรมดาด้วย (`shutdown`, `halt`, `node-red`) ถามเฉพาะตอนอยู่ตำแหน่งคำสั่ง — รวมหลัง `sudo`, `ssh host`, `wsl --`, `cmd /c`, `powershell -Command`, `do`/`then`, `xargs` — ไม่ถามตอนอยู่กลางประโยค (`git commit -m "fix safe shutdown"`, `grep -rn shutdown`, topic `/halt`)
  - **ถามเกินโดยตั้งใจ**: คำเหล่านี้ที่อยู่ต้น quote (`grep "shutdown"`, `-m "halt motion ..."`) เพราะต้องจับ `bash -lc "sudo reboot"` ที่หน้าตาเหมือนกัน
- **COM port ฝั่ง Windows**: `usbipd attach/detach` (ดึง USB-RS485 ไป/กลับ WSL), `mode COM<n>`
- **git ที่ย้อนกลับยาก**: `push`, `reset --hard`, `clean`, `branch -D`, `checkout -- / .`, `restore`

ตั้งใจให้เป็นแบบนี้:
- **ถาม ไม่บล็อก** — งานทดสอบเครื่องหน้างานต้องรันคำสั่งพวกนี้จริง คนกดยืนยันได้
- **ใน VS Code จะไม่เห็นข้อความเหตุผล "gppi: ..."** (CLI เห็น) — ในการทดสอบ prompt ที่ตัวกันถาม **ไม่มีปุ่ม "Yes, allow ... for this project"** แต่ prompt ปกติบางแบบก็อาจไม่มีปุ่มนี้ จึงใช้แยกแบบแน่นอนไม่ได้ — อ่านคำสั่งก่อนกดทุกครั้ง
- **ตัวกันรันไม่ได้ = บล็อกคำสั่ง shell ทั้งหมด** (fail-closed) — ถ้า node ไม่มี/เก่า/ไม่อยู่ใน PATH ของ hook Claude จะได้ข้อความ "gppi: ตัวกันคำสั่ง ... รันไม่ได้" และรัน Bash/PowerShell ไม่ได้จนกว่าจะแก้ ตั้งใจให้เห็นปัญหาตั้งแต่วันแรก ดีกว่าตัวกันพังเงียบๆ แล้วไปเจอตอนต่อเครื่องจริง
  - ข้อยกเว้นที่ยังปล่อยผ่าน (ตัวกันเหลือแค่ mod ซึ่ง **ไม่กันใน auto mode**):
    - Windows ที่ **ไม่มี Git Bash** — hook รันด้วย PowerShell ซึ่งคำสั่งบล็อกแบบ bash (`|| { ...; exit 2; }`) ไม่ทำงาน (ทั้ง 5.1 และ 7; อ่านจาก syntax ยังไม่ได้ทดสอบ) — ติดตั้ง Git for Windows ทุกเครื่อง
    - hook ทำงานเกิน timeout 30 วินาที (เช่น antivirus สแกน node ตอนเปิดครั้งแรก) — Claude Code นับเป็น error ที่ไม่บล็อก
- **ถามได้ในทุก permission mode ที่ทดสอบ** — default, auto (ค่าเริ่มต้นของ CLI) และ `bypassPermissions` (ผลทดสอบ: [docs/plugin-evaluation.md](docs/plugin-evaluation.md#ตัวกันคำสั่ง-gppi-010))
- **prompt ตั้งค่าเริ่มต้นไว้ที่ "1. Yes"** — กด Enter ครั้งเดียวคือ **อนุญาต** ตัวกันทำได้แค่หยุดให้คนตัดสิน อ่านคำสั่งก่อนกดทุกครั้ง โดยเฉพาะตอนต่อเครื่องจริง
- **ไม่ยกเว้นงาน simulator** — จากบรรทัดคำสั่งแยกไม่ออกว่า `ros2 launch` ต่อ driver จริงหรือไม่
- **เปิด bus = ถาม แม้แค่อ่าน** — เปิด RS-485 ที่ระบบใช้อยู่จะชนกับ master ตัวเดิมบน bus
- **จับทุกตำแหน่งในบรรทัด** — จาก Windows มักรันผ่าน `wsl -- bash -lc "... ros2 launch ..."`; ถามเกินบ้าง (เช่น `grep "ros2 launch"`) ดีกว่าหลุด
- ไม่ผ่อน `deny` ที่ระบบตัดสินไว้แล้ว และถ้าตัวกันเองทำงานผิดพลาดจะ **ถาม** แทนการปล่อยผ่าน

> [!WARNING]
> ตัวกัน **ไม่จับ**: wrapper script (`./bringup.sh`, `make run`), โค้ดที่สั่งเครื่องจากข้างใน script ที่เป็นไฟล์ (`python write_plc.py`, node ที่เขียน register เอง), `kill <pid>`, alias/function ของ shell, `bash -c reboot` ที่ไม่มี quote, `doas -u x ...`, docker ที่มี global option ซึ่งไม่อยู่ในรายการ (`--tlscacert ca.pem run`), `nerdctl compose`, การเรียกผ่าน `$(which ros2)` หรือแยกคำด้วย quote — กฎใน `rules.md` จึงยังใช้เต็มที่ และคนต้องอ่านคำสั่งก่อนกดยืนยันทุกครั้ง

## ติดตั้ง
ต้องมีในทุกฝั่งที่ใช้ Claude Code (Windows และ WSL แยกกัน):
- **Claude Code 2.1.287 ขึ้นไป** — mod ต้องใช้เวอร์ชันนี้ (`claude --version`)
- **node 22.18 ขึ้นไป** ที่ hook มองเห็น — ใช้รัน PreToolUse hook; ไม่มี → Claude รันคำสั่ง shell ไม่ได้เลย (fail-closed)
  - Ubuntu/WSL: ติดตั้งจาก NodeSource (`/usr/bin/node` อยู่ใน PATH ทุก shell) — apt ของ 22.04 ให้ node 12 ซึ่งเก่าเกิน; ถ้าใช้ `nvm` ต้องให้ node อยู่ใน PATH ของ shell ที่ไม่ใช่ interactive ด้วย (nvm ตั้ง PATH ใน `.bashrc`)
- **Windows: Git for Windows** — ให้ hook รันด้วย Git Bash (ดูข้อยกเว้นใน [ความปลอดภัย](#ความปลอดภัย))

1. ให้ git ในเครื่องเข้า repo นี้ได้ (repo เป็น private) — Claude Code รัน git แบบไม่ถามรหัส จึงต้องตั้ง credential ไว้ก่อน
   - Windows: `gh auth login` แล้ว `gh auth setup-git`
   - Ubuntu/WSL: fine-grained token แบบ read-only + `git config --global credential.helper store` แล้ว `git clone` ครั้งหนึ่งให้มันจำ token
   - เครื่องที่ใช้ git ผ่าน HTTPS (ไม่ได้ตั้ง SSH key): ตั้ง `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` ก่อน
2. ติดตั้ง:
   ```bash
   claude plugin marketplace add GotPatipan39/gppi
   claude plugin install gppi@gppi
   ```
   หรือในแชท: `/plugin install gppi --marketplace GotPatipan39/gppi`
3. เปิด auto-update: `/plugin` → Marketplaces → `gppi` → Enable auto-update — **ปิดอยู่เป็นค่าเริ่มต้น** สำหรับ marketplace ที่ไม่ใช่ของ Anthropic ถ้าไม่เปิดจะไม่ได้ของใหม่
4. เปิดแชทใหม่ (VS Code: `Ctrl+Shift+P` → **Developer: Reload Window**)
5. ตรวจว่าตัวกันทำงาน — สั่ง Claude ว่า `รัน ros2 topic pub /test std_msgs/msg/String "{}"` ต้อง **ถาม** แล้วกด **No** (ถ้าได้ข้อความ "ตัวกันคำสั่ง ... รันไม่ได้" แปลว่า node ยังไม่พร้อม)

> [!IMPORTANT]
> Windows กับ WSL มี `~/.claude` แยกกัน — ถ้าใช้ Claude Code ทั้งสองฝั่ง ต้องทำขั้น 1–4 **ทั้งสองฝั่ง**

### เครื่องที่เคยใช้ mskills
gppi มาแทน mskills — เปิดทั้งสองตัวพร้อมกันกฎจะซ้ำ 2 ชุด ตัวกันทำงานซ้ำ และ skill มีสองชุด:
```bash
claude plugin uninstall mskills@mskills
claude plugin marketplace remove mskills
```
เครื่องที่เคยใช้ installer รุ่นแรก (ก่อน 2026-10-12) ต้องเก็บของเก่าออกด้วย ไม่อย่างนั้น skill ใน `~/.claude/skills` จะบังตัวใน plugin **โดยไม่มีคำเตือน**:
- ย้าย/ลบ `~/.claude/skills/<ชื่อ skill>` และ `~/.claude/agents/safety-reviewer.md`
- ลบบล็อก `<!-- BEGIN claude-skills ... -->` … `<!-- END claude-skills -->` ใน `~/.claude/CLAUDE.md`
- กฎ `ask` ของ git ที่ installer เคยใส่ใน `~/.claude/settings.json` ปล่อยไว้ได้ (ซ้ำกับตัวกันใน plugin ไม่เสียหาย)

skill ที่เคยอัปโหลดขึ้นแอป Claude (หน้า Skills ของ claude.ai) ให้ลบออก — gppi ไม่ sync ไปที่นั่น และสำเนาเก่าจะตอบด้วยข้อมูลเก่าโดยไม่มีใครรู้

## plugin ส่งอะไรให้บ้าง
| ส่วน | มาจาก | ใช้อย่างไร |
|---|---|---|
| skill 9 ตัว | [`skills/`](skills/) | แสดงเป็น `gppi:<ชื่อ>` — Claude เลือกเองตามตารางใน `rules.md` หรือพิมพ์ `/gppi:tdd` |
| `safety-reviewer` | [`agents/`](agents/) | ต้องเรียกด้วยชื่อเต็ม `gppi:safety-reviewer` (ชื่อสั้นใช้กับ agent ใน plugin ไม่ได้) |
| กฎทุกโปรเจกต์ | [`rules.md`](rules.md) ผ่าน hook `SessionStart` | รันใหม่ตอน resume / clear / compact — แทน `~/.claude/CLAUDE.md` ส่วนกลางเดิม |
| ตัวกันคำสั่ง | [`hooks/gppi.ts`](hooks/gppi.ts) | ดู [ความปลอดภัย](#ความปลอดภัย) |
| ตัวอย่าง permission | [`templates/permissions.json`](templates/permissions.json) | กฎ `ask` ของ git สำหรับ `.claude/settings.json` ของโปรเจกต์ — ใช้เมื่อเครื่องนั้นยังใช้ gppi ไม่ได้ (plugin ส่ง permission rule ไม่ได้) |

- Claude Code ไม่ให้ plugin แก้ system prompt ตรงๆ กฎจึงส่งผ่าน `SessionStart` (`cat rules.md`) — ทดสอบแล้วบน Windows ที่มี Git Bash; เครื่องที่ไม่มี Git Bash จะรันด้วย PowerShell ซึ่ง `cat` เป็น alias ของ `Get-Content` น่าจะใช้ได้ แต่ยังไม่ได้ทดสอบ
- ผลทดสอบตอนย้ายจาก skill ธรรมดามาเป็น plugin: [docs/plugin-evaluation.md](docs/plugin-evaluation.md)

## skill
| skill | เวอร์ชัน | ใช้กับ |
|---|---|---|
| `ros2-humble-cpp` | 3.2.1 | งาน ROS2 Humble + C++ |
| `modbus` | 1.1.0 | งาน Modbus RTU/TCP ทุกแบบ (C++, Node-RED, Python) |
| `industrial-ui` | 1.2.0 | UI/UX งานอุตสาหกรรม: HMI, dashboard, หน้า config (Web, Node-RED Dashboard, Grafana) |
| `opencv` | 1.0.1 | machine vision ด้วย OpenCV (Python/C++, ROS2 node หรือโปรแกรมแยก): นับ/ตรวจชิ้นงาน, วัดขนาด, หาตำแหน่งให้ robot, QR/barcode, กล้อง UVC/industrial/depth/RTSP |
| `project-readme` | 1.0.0 | เขียน/ปรับ README ของโปรเจกต์ให้ทีมบน GitLab อ่านเข้าใจ (ต้นแบบ: borunte-control) |
| `git-commit` | 1.2.0 | commit message (Conventional Commits + body อธิบายเหตุผล), ตรวจของที่ห้าม commit, release `vX.Y.Z` + CHANGELOG + tag |
| `tdd` | 1.0.0 | เขียน logic/แก้บั๊กแบบ test ก่อน (red → green → refactor) ทุกภาษา, mock ที่ขอบ hardware |
| `grilling` | ภายนอก | ซักถามแผนงาน/การออกแบบทีละรอบจนไม่มีอะไรค้าง |
| `domain-modeling` | ภายนอก | จดศัพท์โปรเจกต์ (`GLOSSARY.md`) และการตัดสินใจสำคัญ (`docs/adr/`) |

`grilling` และ `domain-modeling` copy มาจาก mattpocock/skills (MIT) @ d81f3a1, 2026-09-29 แบบไม่แก้เนื้อหา — ไฟล์ `LICENSE` อยู่ในโฟลเดอร์ของแต่ละตัว และเป็นตัวบอกว่า skill นั้นมาจากภายนอก

## subagent
Claude อีกตัวที่ Claude หลักส่งงานไปให้ทำ — มี context แยก (ไม่เห็นแชท) และจำกัด tool ได้ เหมาะกับงานตรวจที่ต้องการมุมมองคนนอก

| subagent | เวอร์ชัน | ใช้กับ | ถูกเรียกจาก |
|---|---|---|---|
| `safety-reviewer` | 1.0.0 | ตรวจ diff ก่อน commit ในโปรเจกต์ที่คุมเครื่องจักร: เกณฑ์ความปลอดภัยที่ถูกลด, ค่า hardware ที่เปลี่ยน, คำสั่งขยับที่ไม่มีเงื่อนไข, ตอนสื่อสารล้มเหลว, test ที่ถูกแก้ให้ผ่าน — อ่านอย่างเดียว | skill `git-commit` (ขั้นตอนที่ 2) หรือสั่งเอง: "ให้ safety-reviewer ตรวจ" / พิมพ์ `@` แล้วเลือก |

- เวอร์ชันอยู่ในบรรทัด `> เวอร์ชัน` ของไฟล์ agent; แก้แล้วขึ้นเลขในตารางนี้ และเขียนเหตุผลใน commit message
- Bash ของ `safety-reviewer` จำกัดแค่ด้วยคำสั่งในไฟล์ agent (อ่าน git อย่างเดียว) ไม่ใช่ด้วยระบบ — ตัวกันคำสั่งของ plugin ยังมีผลกับ subagent ตามปกติ

## ข้อมูลเฉพาะโปรเจกต์
ข้อมูลเฉพาะโปรเจกต์ (address map, hardware, กฎเฉพาะเครื่อง) ให้เขียนใน `CLAUDE.md` ที่ root ของโปรเจกต์ ไม่ใส่ใน skill — ถ้าขัดกับ `rules.md` ให้ยึดของโปรเจกต์
การตัดสินใจสำคัญของโปรเจกต์ (ย้อนกลับยาก + คนอ่านทีหลังจะสงสัย + มีทางเลือกจริง) จดเป็น ADR ใน `docs/adr/` ของโปรเจกต์

## โครงสร้าง
```
gppi/
├── .claude-plugin/        ← plugin.json (ชื่อ + เวอร์ชัน) + marketplace.json
├── skills/<ชื่อ>/         ← skill ทั้งหมด; มีไฟล์ LICENSE = มาจากภายนอก ห้ามแก้เนื้อหา
├── agents/<ชื่อ>.md       ← subagent
├── hooks/                 ← hooks.json (SessionStart + PreToolUse) + gppi.ts (logic ตัวกัน + mod) + pretooluse.ts (hook) + gppi.test.ts
├── rules.md               ← กฎทุกโปรเจกต์ที่ Claude อ่านทุก session
├── templates/             ← ตัวอย่าง config ให้ copy ไปใช้ในโปรเจกต์
├── docs/                  ← ผลทดสอบ + docs/adr/ (การตัดสินใจของ repo นี้)
└── README.md
```

## พัฒนาและออกเวอร์ชัน
ทีมเสนอแก้ผ่าน issue / merge request (PR) — เจ้าของ repo เป็นคน merge และออก release

1. แก้ใน repo นี้ (หรือให้ Claude แก้) — skill: ขึ้นเวอร์ชันใน `SKILL.md` + `CHANGELOG.md` ของ skill นั้น และตาราง skill ด้านบน; เพิ่ม skill ใหม่: เพิ่มแถวในตาราง "ใช้ skill ตามงาน" ของ `rules.md` ด้วย
2. ทดสอบ:
   ```bash
   claude plugin validate . --strict
   claude plugin test .                 # test ของตัวกันคำสั่ง (hooks/gppi.test.ts)
   claude --plugin-dir .                # ลองใช้จริงโดยไม่ติดตั้ง — ปิด gppi ที่ติดตั้งไว้ก่อน ไม่อย่างนั้นจะโหลดซ้ำ
   ```
   แก้ตัวกันคำสั่ง: เพิ่ม test case ของคำสั่งที่ต้องถาม/ไม่ต้องถามก่อนแก้ regex (skill `tdd`)
3. ออกเวอร์ชัน (ทำตาม skill `git-commit` หัวข้อ "ข้อยกเว้น: repo gppi") — **ทีมได้ของใหม่ก็ต่อเมื่อเลข `version` ใน [`plugin.json`](.claude-plugin/plugin.json) เปลี่ยน** การ push ขึ้น main อย่างเดียวไม่ไปถึงเครื่องใคร ตั้งใจให้เป็นแบบนี้ เพื่อไม่ให้งานที่ยังไม่เสร็จไปถึงเครื่องที่คุม hardware
4. เครื่องที่ไม่ได้เปิด auto-update: `claude plugin marketplace update gppi && claude plugin update gppi@gppi` แล้วเปิดแชทใหม่

ถอยกลับเป็นรุ่นก่อน: `git revert` แล้วออกเวอร์ชันใหม่ (เลขต้องขึ้นเสมอ ไม่ย้อนเลข)

เช็กว่าเครื่องใช้รุ่นไหน: `claude plugin list` แสดง `Version` ของ gppi ที่ติดตั้ง

## การตัดสินใจ
- [ADR-0001](docs/adr/0001-single-team-plugin.md) — plugin ก้อนเดียว ไม่แยกตามโดเมน เพื่อให้กฎความปลอดภัยติดไปทุกเครื่อง
- [ADR-0003](docs/adr/0003-guard-hook-plus-mod.md) — ตัวกันคำสั่งเป็น PreToolUse hook (node) ซ้อนกับ mod เพราะใน auto mode `ask` ของ mod ถูก classifier อนุมัติแทนคน (แทน [ADR-0002](docs/adr/0002-guard-as-mod.md))

## รับ skill จากภายนอก
ไม่ติดตั้งด้วย `npx skills add` หรือ `/plugin install` ของคนอื่นตรงๆ — ให้ Claude อ่านก่อนทุกครั้ง แล้วเลือกอย่างใดอย่างหนึ่ง:
- **copy มาตรงๆ** เมื่อเนื้อหาดีและไม่ขัดกับหลักของเรา — วางไว้ที่ `skills/<ชื่อ>/` พร้อมไฟล์ `LICENSE` ของต้นทางในโฟลเดอร์เดียวกัน, บันทึกที่มา, commit/วันที่, license ในตาราง skill ด้านบน
- **ดัดแปลงเข้า skill ของเรา** เมื่อดีบางส่วน — บันทึกใน CHANGELOG ว่าเอาอะไรมาจากไหน และไม่เอาอะไรเพราะอะไร
- **ไม่ใช้** — จดเหตุผลไว้ด้านล่าง กันพิจารณาซ้ำ

ชื่อ skill ห้ามซ้ำกับตัวที่มีอยู่ เพราะ plugin รวมเป็นชุดเดียว

สิ่งที่ต้องตรวจ:
1. อ่าน `SKILL.md` และ **ทุกไฟล์ที่มันอ้างถึง** (บางตัวเป็นแค่ตัวเรียก skill อื่น หรือเป็น stub ที่ให้ไปโหลดเนื้อหาจาก CLI)
2. มี script / hook / `allowed-tools` ที่รันคำสั่งเองไหม — ถ้ามี ต้องอ่านว่ารันอะไร (plugin ของคนอื่นอาจพา hook และ MCP server มาด้วย)
3. ต้องใช้ internet หรือบริการภายนอกตอนใช้งานไหม — ถ้าใช่ ต้องรู้ว่าส่งข้อมูลอะไรออกไป
4. `description` กว้างเกินไปจนแย่ง skill อื่นไหม (เช่น "ให้ใช้ตัวนี้แทน tool อื่นทุกตัว")
5. เนื้อหาถูกต้องไหม และตรงกับเวอร์ชันที่เราใช้ไหม (เช่น ROS2 Humble)
6. ขัดกับหลักของเราไหม (ความปลอดภัยของเครื่อง, ROS2 local เท่านั้น, ห้ามเดาค่า hardware)
7. ที่มาน่าเชื่อถือไหม: ผู้ทำ, license, อัปเดตล่าสุด, จำนวนผู้ใช้/star

### ตรวจแล้ว ไม่ใช้ หรือใช้แค่บางส่วน
| skill | ผล |
|---|---|
| mattpocock/skills `grill-me`, `grill-with-docs`, `handoff` | เคย copy มา ถอดออกตอนย้ายเป็น gppi — สองตัวแรกเป็นแค่ตัวเรียก `grilling` / `domain-modeling`, `handoff` ทีมยังไม่ได้ใช้ |
| omer-metin/skills-for-antigravity `ros2-robotics` | ไม่ใช้ — description เสีย (`Use when ", " mentioned.`), เนื้อหาบางส่วนผิด, น่าจะสร้างอัตโนมัติ |
| arpitg1304/robotics-agent-skills `docker-ros2-development` | ไม่ใช้ตอนนี้ — เนื้อหาดี แต่ยังไม่ใช้ Docker (WSL + mini PC + PM2 พอ) พิจารณาใหม่เมื่อต้อง deploy หลายเครื่อง/แบบ offline |
| vercel-labs/agent-browser `agent-browser` | ไม่ใช้ — เป็น stub ต้องติดตั้ง CLI + Chrome, description กว้างเกิน, ส่วนใหญ่ไม่เกี่ยว (Slack, Vercel, AWS) ทดสอบ UI ใช้ Playwright แทน |
| vercel-labs/skills `find-skills` | ไม่ใช้ — ต้องใช้ internet และให้ติดตั้ง skill เองแบบข้ามการยืนยัน (`-y`) ขัดกับขั้นตอนตรวจข้างบน (นำเกณฑ์คัดคุณภาพมาใส่ข้อ 7) |
| anthropics/skills `frontend-design` | บางส่วน — ไม่ copy (เน้นดีไซน์แปลกใหม่ ขัดกับ HMI) ดัดแปลงเข้า `industrial-ui` 1.1.0 |
| arpitg1304 `ros2`, dbwls99706 `ros2-engineering-skills` | บางส่วน — คัด references / ดัดแปลงเข้า `ros2-humble-cpp` 2.0.0 |
| arpitg1304 `ros2-web-integration` | บางส่วน — ดัดแปลงเข้า `industrial-ui` 1.2.0 (แก้ watchdog teleop และการตั้ง parameter) |
| github/awesome-copilot `create-readme` | ไม่ใช้ — สั้นมาก (21 บรรทัด), ต้องโหลด README ตัวอย่าง 4 ไฟล์จาก internet ทุกครั้ง, เน้น README โปรเจกต์ open source ไม่ใช่งานเครื่องจักร; ส่วนที่ดี (กระชับ, ไม่ซ้ำกับ LICENSE/CHANGELOG, ใช้ GitHub admonition) จดไว้ใช้ถ้าทำ skill README ของเราเอง |
| github/awesome-copilot `git-commit` @ 143a3d9 | บางส่วน — ดัดแปลงเข้า `git-commit` 1.0.0: เอาตาราง type ของ Conventional Commits และกฎความปลอดภัยของ git; ที่ไม่เอา: `allowed-tools: Bash` (รัน Bash ทุกคำสั่งได้โดยไม่ถามระหว่างที่ skill ทำงาน), แนะนำ `git add -p` (interactive ใช้ใน Claude Code ไม่ได้), ไม่มีเรื่องระดับการทดสอบและสิ่งที่ห้าม commit (IP/ค่าเครื่องจริง) |
| mattpocock/skills `git-guardrails-claude-code` @ d81f3a1 | ไม่ใช้ — hook ใช้ `jq` ซึ่งไม่มีบน Windows เครื่องนี้ ทดสอบแล้ว hook ไม่บล็อกอะไรเลยและไม่เตือน, ดักแค่ Bash ไม่ดัก PowerShell tool, บล็อก `git push` ทั้งหมด, จับคำสั่งด้วย regex หลวมจนข้อความใน commit message ก็โดน; ใช้ตัวกันใน `hooks/gppi.ts` แทน (ไม่ต้องใช้ jq, ดักทั้ง Bash และ PowerShell, ถามแทนบล็อก) |
| anthropics/skills `skill-creator` @ 8a1541c (Apache-2.0) | ไม่ใช้ — ไม่ copy เข้า repo: มีฉบับที่ซิงก์จากบัญชี claude.ai (`anthropic-skills:skill-creator`) ในเครื่องอยู่แล้ว เรียกใช้ได้เมื่อต้องการ; หลักการเขียน skill (อธิบายเหตุผลแทน MUST, SKILL.md < 500 บรรทัด, แยก references, สัมภาษณ์ก่อนเขียน) เราทำอยู่แล้ว; description แบบ "pushy" ขัดข้อ 4; `run_loop.py` ปรับ description ใช้บน Windows ไม่ได้ (`select()` บน pipe → นับทุก query เป็นไม่ trigger โดยไม่ error, ไม่ระบุ encoding → พังกับภาษาไทย cp874) และต้องมี `claude` CLI + เรียก `claude -p` ราว 360 ครั้งต่อ skill; viewer โหลด Google Fonts/SheetJS จาก CDN และ kill ทุก process บน port 3117; ส่วนที่มีประโยชน์ (รันเทียบมี/ไม่มี skill ด้วย subagent) ทำได้โดยไม่ต้องติดตั้งอะไร |
| obra/superpowers `using-git-worktrees` @ 8ca22db | ไม่ใช้ — description กว้างจนทำงานทุกครั้งที่เริ่ม feature, รัน `npm/pip/poetry install` เอง (ต้องใช้ internet, ไม่รองรับ colcon), ROS2 ต้อง build แยกทุก worktree และรันพร้อมกันจะแย่ง `/dev/ttyUSB*`; Claude Code มี worktree ในตัวอยู่แล้ว |
| mattpocock/skills `tdd` @ 3f59913 (MIT) | บางส่วน — ดัดแปลงเป็น `tdd` 1.0.0 ของเรา: เอาการตกลง seam ก่อนเขียน test, anti-pattern (tautological, ผูกกับ implementation, horizontal slicing), mock เฉพาะขอบระบบ; ไม่ copy ตรงๆ เพราะเรียก skill `codebase-design` และ `code-review` ของเขาที่เราไม่มี (`code-review` จะไปชนกับ `/code-review` ของ Claude Code), ตัวอย่างเป็น TypeScript/checkout ทั้งหมด, ไม่พูดถึง hardware; ใส่ refactor กลับเข้าลูป |
| tondevrel/scientific-agent-skills `opencv` @ 6e89d9e (MIT แต่ frontmatter เขียน Apache-2.0) | ไม่ใช้ — เขียน `opencv` 1.0.0 ของเราเองแทน: เป็นคู่มือ cv2 แบบ notebook (Python อย่างเดียว, `imshow` ทุกตัวอย่าง, `pip install opencv-python` ซึ่งชนกับ OpenCV 4.5.4 ของ Humble/cv_bridge); ผิด: บอกว่า SIFT อยู่ใน contrib (ย้ายเข้า main ตั้งแต่ 4.4), วาดกรอบ QR ผิด shape ของ 4.x, threaded capture ใช้ queue 128 เฟรม (ภาพช้าสะสม) และ release ข้าม thread; description อ้างว่ามี calibration/DNN แต่ไม่มีเนื้อหา; ไม่มี C++, cv_bridge, กล้อง industrial/depth, pixel→mm; ทั้ง repo 72 skill มาใน commit เดียวไม่เคยอัปเดต |
| anthropics/claude-code plugin-dev `Plugin Structure`, `Plugin Settings` @ 3deb873 | ไม่ใช้ — license "All rights reserved" (Commercial Terms) copy เข้า repo ไม่ได้; หลายจุดเก่ากว่าที่ทดสอบกับ Claude Code 2.1.296: `hooks.json` ไม่ครอบด้วย `{"hooks": ...}`, ชื่อ skill มีช่องว่าง (ชื่อสั้นใช้เรียกไม่ได้), agent ไม่มี `name` และใช้ `capabilities:`, บอกว่าชื่อซ้ำจะ error (จริงคือ `~/.claude/skills` บังตัวใน plugin เงียบๆ), ไม่พูดถึง prefix `plugin:` ของ agent, เน้น `commands/`; script ตัวอย่างใช้ `jq`; ที่นำมาใช้: matcher ของ `SessionStart` (`startup/resume/clear/compact`), ใส่ `timeout` ให้ hook, quote `${CLAUDE_PLUGIN_ROOT}`; ทดสอบแล้วว่าไม่ใส่ `version` = ติดตาม commit (ไม่ใช่ 0.1.0 อย่างที่ skill นี้บอก) — gppi เลือกใส่ `version` เองเพื่อคุมว่าทีมได้ของใหม่เมื่อไหร่ |
