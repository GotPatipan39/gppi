# mskills

**m**achine **skills** — skill สำหรับ Claude Code (VS Code / CLI) และแอป Claude — เก็บไว้ที่เดียว แล้วติดตั้งลงเครื่องหรือลงโปรเจกต์ด้วย script

## เริ่มต้นบนเครื่องใหม่
```powershell
git clone <url ของ repo นี้บน GitHub> D:\ws\mskills
```
แล้วดับเบิลคลิก `install-global.bat` — เท่านี้ Claude Code บนเครื่องนั้นก็ใช้ skill ได้ทุกโปรเจกต์
(clone ไว้ที่ไหนก็ได้ script หา path จากตำแหน่งของตัวเอง; ใน WSL ใช้ `bash <path>/scripts/install-skills.sh`)

## โครงสร้าง
```
mskills/
├── install-global.bat, install-all-global.bat, install-to-project.bat   ← ดับเบิลคลิก
├── skills/<ชื่อ>/              ← skill ของเราเอง (แก้ได้)
├── vendor/<ที่มา>/LICENSE      ← skill จากภายนอก copy มาตรงๆ ห้ามแก้เนื้อหา
│   └── <ชื่อ>/                    (ตอนนี้มี vendor/mattpocock/)
├── config/global-CLAUDE.md     ← กฎระดับเครื่อง (~/.claude/CLAUDE.md)
├── config/permissions.json     ← กฎขอยืนยันคำสั่ง git อันตราย (รวมเข้า ~/.claude/settings.json)
└── scripts/install-skills.ps1, install-skills.sh
```
script หา skill จากทั้ง `skills/` และ `vendor/*/` แต่ติดตั้งลงปลายทางด้วยชื่อ skill อย่างเดียว (เช่น `~/.claude/skills/grilling`) ชื่อ skill จึงห้ามซ้ำกันข้ามโฟลเดอร์ ถ้าซ้ำ script จะหยุดและแจ้ง
skill จาก `vendor/` จะได้ `LICENSE` ของที่มานั้น copy ไปไว้ในโฟลเดอร์ skill ที่ติดตั้งด้วย

## อัปเดต skill
1. แก้ skill ในโฟลเดอร์นี้ (หรือให้ Claude แก้)
2. `git diff` ดูว่าเปลี่ยนอะไร → อัปเดตเวอร์ชันใน `SKILL.md` + `CHANGELOG.md` ของ skill นั้น และตารางด้านล่าง → commit → push
3. เครื่องอื่น: `git pull` แล้วดับเบิลคลิก install อีกครั้ง; โปรเจกต์ที่ copy skill ไปแล้ว: รัน `install-to-project.bat` ทับ
4. แอป Claude: อัปโหลด zip ของ skill ที่เปลี่ยน (ดู "ใช้ในแอป Claude")

## skill ของเราเอง (`skills/`)
| skill | เวอร์ชัน | ใช้กับ |
|---|---|---|
| `ros2-humble-cpp` | 3.2.0 | งาน ROS2 Humble + C++ |
| `modbus` | 1.0.0 | งาน Modbus RTU/TCP ทุกแบบ (C++, Node-RED, Python) |
| `industrial-ui` | 1.2.0 | UI/UX งานอุตสาหกรรม: HMI, dashboard, หน้า config (Web, Node-RED Dashboard, Grafana) |
| `project-readme` | 1.0.0 | เขียน/ปรับ README ของโปรเจกต์ให้ทีมบน GitLab อ่านเข้าใจ (ต้นแบบ: borunte-control) |
| `git-commit` | 1.0.0 | commit message (Conventional Commits + body อธิบายเหตุผล), ตรวจของที่ห้าม commit, release `vX.Y.Z` + CHANGELOG + tag |
| `tdd` | 1.0.0 | เขียน logic/แก้บั๊กแบบ test ก่อน (red → green → refactor) ทุกภาษา, mock ที่ขอบ hardware |

## skill จากภายนอก (`vendor/`, copy มาตรงๆ ไม่แก้เนื้อหา)
| skill | ที่มา | ใช้กับ | ต้อง copy คู่กับ |
|---|---|---|---|
| `grilling` | mattpocock/skills (MIT, [`vendor/mattpocock/LICENSE`](vendor/mattpocock/LICENSE)) @ d81f3a1, 2026-09-29 | ซักถามแผนงาน/การออกแบบทีละรอบจนไม่มีอะไรค้าง | — |
| `grill-me` | เหมือนข้างบน | ตัวเรียก `grilling` (พิมพ์ `/grill-me`) | **`grilling`** |
| `domain-modeling` | เหมือนข้างบน | จดศัพท์โปรเจกต์ (`GLOSSARY.md`) และการตัดสินใจสำคัญ (`docs/adr/`) | — |
| `grill-with-docs` | เหมือนข้างบน | ซักถาม + จด GLOSSARY/ADR ไปพร้อมกัน (พิมพ์ `/grill-with-docs`) | **`grilling`** และ **`domain-modeling`** |

`grill-me` และ `grill-with-docs` เป็นแค่ตัวเรียก — ถ้า copy ไปโดยไม่มีตัวที่มันเรียก จะใช้ไม่ได้

## เอาไปใช้ใน VS Code
**แบบง่าย (ดับเบิลคลิก):**
- `install-global.bat` — ติดตั้ง skill ทั่วไป (grilling, domain-modeling, project-readme, git-commit, tdd ...) ให้ใช้ได้ทุกโปรเจกต์
- `install-all-global.bat` — ติดตั้ง **ทุก skill** ให้ใช้ได้ทุกโปรเจกต์
- `install-to-project.bat` — เลือกโฟลเดอร์โปรเจกต์จากหน้าต่าง แล้วพิมพ์หมายเลข skill ที่ต้องการ (หรือพิมพ์ `all` = ทุกตัว)

**กฎระดับเครื่อง:** `install-global.bat` / `install-all-global.bat` ติดตั้ง [`config/global-CLAUDE.md`](config/global-CLAUDE.md) เป็น `~/.claude/CLAUDE.md` ด้วย — Claude Code อ่านไฟล์นี้ **ทุกแชท ทุกโปรเจกต์** จึงรู้ว่างานไหนต้องใช้ skill ไหนโดยไม่ต้องสั่ง
- ใส่ไว้ในบล็อก `<!-- BEGIN claude-skills -->` … `<!-- END claude-skills -->` — เนื้อหาอื่นที่เขียนเองในไฟล์นั้นไม่ถูกแตะ, รันซ้ำจะแทนที่เฉพาะบล็อก
- แก้กฎ: แก้ `config/global-CLAUDE.md` ที่นี่ แล้วดับเบิลคลิก `install-global.bat` อีกครั้ง
- เพิ่ม skill ใหม่: สร้างใน `skills/<ชื่อ>/` และเพิ่มแถวในตาราง "ใช้ skill ตามงาน" ของ `config/global-CLAUDE.md` ด้วย

**กฎขอยืนยันคำสั่ง:** `install-global.bat` / `install-all-global.bat` เอากฎใน [`config/permissions.json`](config/permissions.json) ไปรวมเข้า `~/.claude/settings.json` — ตอนนี้เป็นกฎ `ask` ให้ Claude Code เด้งกล่องขอยืนยันก่อน `git push`, `reset --hard`, `clean`, `branch -D`, `checkout -- / .`, `restore` (ทั้ง Bash และ PowerShell tool)
- **เพิ่มอย่างเดียว ไม่ลบ** — กฎที่ settings.json มีอยู่แล้ว และค่าอื่นในไฟล์ (model, hooks ...) ไม่ถูกแตะ; รันซ้ำไม่เพิ่มกฎซ้ำ; ไม่มีกฎใหม่ = ไม่เขียนไฟล์
- ลบกฎออกจาก `permissions.json` แล้ว เครื่องที่ติดตั้งไปแล้วยังมีกฎนั้นอยู่ — ต้องลบเองใน `~/.claude/settings.json` ของเครื่องนั้น (ตั้งใจ: ไม่ให้ script ลบกฎที่ตั้งเองบนเครื่อง)
- settings.json ที่ JSON เสีย → script ข้าม ไม่แตะไฟล์ และเตือน
- ใช้ `ask` ไม่ใช่ hook บล็อก: hook แบบ mattpocock ต้องใช้ `jq` (Windows ไม่มี) และดักแค่ Bash — ดูตาราง "ตรวจแล้ว" ด้านล่าง

**แบบสั่งเอง:** ใช้ script — skill ที่ต้องใช้คู่กันจะถูก copy ให้อัตโนมัติ, copy ทับของเดิม (รันซ้ำได้เมื่อ skill อัปเดต)

**Windows (PowerShell):**
```powershell
cd D:\ws\mskills
# skill ทั่วไป (grilling, domain-modeling ...) → ใช้ได้ทุกโปรเจกต์
powershell -ExecutionPolicy Bypass -File .\scripts\install-skills.ps1
# skill เฉพาะโปรเจกต์
powershell -ExecutionPolicy Bypass -File .\scripts\install-skills.ps1 -Project D:\ws\fg-robot-pallet -Skills ros2-humble-cpp,modbus,industrial-ui
# ดูก่อนว่าจะ copy อะไร (ยังไม่ copy จริง): เติม -WhatIf
```

**WSL:**
```bash
bash /mnt/d/ws/mskills/scripts/install-skills.sh                                # skill ทั่วไป → ทุกโปรเจกต์ (แก้ path ตามที่ clone ไว้)
bash /mnt/d/ws/mskills/scripts/install-skills.sh --all                          # ทุก skill → ทุกโปรเจกต์ (เหมือน install-all-global.bat)
bash /mnt/d/ws/mskills/scripts/install-skills.sh -p ~/fg-robot-pallet ros2-humble-cpp modbus industrial-ui
bash /mnt/d/ws/mskills/scripts/install-skills.sh -p ~/fg-robot-pallet --all
```
เสร็จแล้วใน VS Code: `Ctrl+Shift+P` → **Developer: Reload Window** แล้วพิมพ์ `/` เพื่อดูรายการ skill

ข้อมูลเฉพาะโปรเจกต์ (address map, hardware, กฎเฉพาะเครื่อง) ให้เขียนใน `CLAUDE.md` ที่ root ของโปรเจกต์ ไม่ใส่ใน skill
การตัดสินใจสำคัญของโปรเจกต์ (ย้อนกลับยาก + คนอ่านทีหลังจะสงสัย + มีทางเลือกจริง) จดเป็น ADR ใน `docs/adr/` ของโปรเจกต์

## ใช้ในแอป Claude
skill ในแอป Claude ผูกกับบัญชี ไม่ได้อ่านจากโฟลเดอร์นี้ — ต้องอัปโหลดเองในหน้า Skills (`+ Add`)
- skill ที่มีหลายไฟล์ อัปโหลดเป็น `.zip` ของโฟลเดอร์ skill (คลิกขวาที่โฟลเดอร์ → Compress to ZIP) ไม่งั้นไฟล์ประกอบจะหาย
- `_upload/` เป็นที่พักไฟล์ zip สำหรับอัปโหลด ไม่เก็บใน git (อยู่ใน `.gitignore`)

## เช็กว่าโปรเจกต์ใช้เวอร์ชันไหน
ดูบรรทัด "เวอร์ชัน" ใน `SKILL.md` ที่อยู่ใน `.claude/skills/` ของโปรเจกต์นั้น เทียบกับตารางด้านบน

## รับ skill จากภายนอก
ไม่ติดตั้งด้วย `npx skills add` ตรงเข้าโปรเจกต์ — ให้ Claude อ่านก่อนทุกครั้ง แล้วเลือกอย่างใดอย่างหนึ่ง:
- **copy มาตรงๆ** (ตาราง "skill จากภายนอก") เมื่อเนื้อหาดีและไม่ขัดกับหลักของเรา — วางไว้ที่ `vendor/<ที่มา>/<ชื่อ>/` พร้อม `vendor/<ที่มา>/LICENSE` ไฟล์เดียว, บันทึกที่มา, commit/วันที่, license
- **ดัดแปลงเข้า skill ของเรา** เมื่อดีบางส่วน — บันทึกใน CHANGELOG ว่าเอาอะไรมาจากไหน และไม่เอาอะไรเพราะอะไร
- **ไม่ใช้** — จดเหตุผลไว้ด้านล่าง กันพิจารณาซ้ำ

สิ่งที่ต้องตรวจ:
1. อ่าน `SKILL.md` และ **ทุกไฟล์ที่มันอ้างถึง** (บางตัวเป็นแค่ตัวเรียก skill อื่น หรือเป็น stub ที่ให้ไปโหลดเนื้อหาจาก CLI)
2. มี script / hook / `allowed-tools` ที่รันคำสั่งเองไหม — ถ้ามี ต้องอ่านว่ารันอะไร
3. ต้องใช้ internet ตอนใช้งานไหม (ขัดกับ local เท่านั้น)
4. `description` กว้างเกินไปจนแย่ง skill อื่นไหม (เช่น "ให้ใช้ตัวนี้แทน tool อื่นทุกตัว")
5. เนื้อหาถูกต้องไหม และตรงกับเวอร์ชันที่เราใช้ไหม (เช่น ROS2 Humble)
6. ขัดกับหลักของเราไหม (ความปลอดภัยของเครื่อง, local เท่านั้น, ห้ามเดาค่า hardware)
7. ที่มาน่าเชื่อถือไหม: ผู้ทำ, license, อัปเดตล่าสุด, จำนวนผู้ใช้/star

### ตรวจแล้ว ไม่ใช้ หรือใช้แค่บางส่วน
| skill | ผล |
|---|---|
| omer-metin/skills-for-antigravity `ros2-robotics` | ไม่ใช้ — description เสีย (`Use when ", " mentioned.`), เนื้อหาบางส่วนผิด, น่าจะสร้างอัตโนมัติ |
| arpitg1304/robotics-agent-skills `docker-ros2-development` | ไม่ใช้ตอนนี้ — เนื้อหาดี แต่ยังไม่ใช้ Docker (WSL + mini PC + PM2 พอ) พิจารณาใหม่เมื่อต้อง deploy หลายเครื่อง/แบบ offline |
| vercel-labs/agent-browser `agent-browser` | ไม่ใช้ — เป็น stub ต้องติดตั้ง CLI + Chrome, description กว้างเกิน, ส่วนใหญ่ไม่เกี่ยว (Slack, Vercel, AWS) ทดสอบ UI ใช้ Playwright แทน |
| vercel-labs/skills `find-skills` | ไม่ใช้ — ต้องใช้ internet และให้ติดตั้ง skill เองแบบข้ามการยืนยัน (`-y`) ขัดกับขั้นตอนตรวจข้างบน (นำเกณฑ์คัดคุณภาพมาใส่ข้อ 7) |
| anthropics/skills `frontend-design` | บางส่วน — ไม่ copy (เน้นดีไซน์แปลกใหม่ ขัดกับ HMI) ดัดแปลงเข้า `industrial-ui` 1.1.0 |
| arpitg1304 `ros2`, dbwls99706 `ros2-engineering-skills` | บางส่วน — คัด references / ดัดแปลงเข้า `ros2-humble-cpp` 2.0.0 |
| arpitg1304 `ros2-web-integration` | บางส่วน — ดัดแปลงเข้า `industrial-ui` 1.2.0 (แก้ watchdog teleop และการตั้ง parameter) |
| github/awesome-copilot `create-readme` | ไม่ใช้ — สั้นมาก (21 บรรทัด), ต้องโหลด README ตัวอย่าง 4 ไฟล์จาก internet ทุกครั้ง, เน้น README โปรเจกต์ open source ไม่ใช่งานเครื่องจักร; ส่วนที่ดี (กระชับ, ไม่ซ้ำกับ LICENSE/CHANGELOG, ใช้ GitHub admonition) จดไว้ใช้ถ้าทำ skill README ของเราเอง |
| github/awesome-copilot `git-commit` @ 143a3d9 | บางส่วน — ดัดแปลงเข้า `git-commit` 1.0.0: เอาตาราง type ของ Conventional Commits และกฎความปลอดภัยของ git; ที่ไม่เอา: `allowed-tools: Bash` (รัน Bash ทุกคำสั่งได้โดยไม่ถามระหว่างที่ skill ทำงาน), แนะนำ `git add -p` (interactive ใช้ใน Claude Code ไม่ได้), ไม่มีเรื่องระดับการทดสอบและสิ่งที่ห้าม commit (IP/ค่าเครื่องจริง) |
| mattpocock/skills `git-guardrails-claude-code` @ d81f3a1 | ไม่ใช้ — hook ใช้ `jq` ซึ่งไม่มีบน Windows เครื่องนี้ ทดสอบแล้ว hook ไม่บล็อกอะไรเลยและไม่เตือน, ดักแค่ Bash ไม่ดัก PowerShell tool, บล็อก `git push` ทั้งหมด, จับคำสั่งด้วย regex หลวมจนข้อความใน commit message ก็โดน; ใช้ `permissions` ใน `settings.json` แทน |
| anthropics/skills `skill-creator` @ 8a1541c (Apache-2.0) | ไม่ใช้ — ไม่ copy เข้า repo: มีฉบับที่ซิงก์จากบัญชี claude.ai (`anthropic-skills:skill-creator`) ในเครื่องอยู่แล้ว เรียกใช้ได้เมื่อต้องการ; หลักการเขียน skill (อธิบายเหตุผลแทน MUST, SKILL.md < 500 บรรทัด, แยก references, สัมภาษณ์ก่อนเขียน) เราทำอยู่แล้ว; description แบบ "pushy" ขัดข้อ 4; `run_loop.py` ปรับ description ใช้บน Windows ไม่ได้ (`select()` บน pipe → นับทุก query เป็นไม่ trigger โดยไม่ error, ไม่ระบุ encoding → พังกับภาษาไทย cp874) และต้องมี `claude` CLI + เรียก `claude -p` ราว 360 ครั้งต่อ skill; viewer โหลด Google Fonts/SheetJS จาก CDN และ kill ทุก process บน port 3117; ส่วนที่มีประโยชน์ (รันเทียบมี/ไม่มี skill ด้วย subagent) ทำได้โดยไม่ต้องติดตั้งอะไร |
| obra/superpowers `using-git-worktrees` @ 8ca22db | ไม่ใช้ — description กว้างจนทำงานทุกครั้งที่เริ่ม feature, รัน `npm/pip/poetry install` เอง (ต้องใช้ internet, ไม่รองรับ colcon), ROS2 ต้อง build แยกทุก worktree และรันพร้อมกันจะแย่ง `/dev/ttyUSB*`; Claude Code มี worktree ในตัวอยู่แล้ว |
| mattpocock/skills `tdd` @ 3f59913 (MIT) | บางส่วน — ดัดแปลงเป็น `tdd` 1.0.0 ของเรา: เอาการตกลง seam ก่อนเขียน test, anti-pattern (tautological, ผูกกับ implementation, horizontal slicing), mock เฉพาะขอบระบบ; ไม่ copy ตรงๆ เพราะเรียก skill `codebase-design` และ `code-review` ของเขาที่เราไม่มี (`code-review` จะไปชนกับ `/code-review` ของ Claude Code), ตัวอย่างเป็น TypeScript/checkout ทั้งหมด, ไม่พูดถึง hardware; ใส่ refactor กลับเข้าลูป |
