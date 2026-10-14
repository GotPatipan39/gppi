# mskills

**m**achine **skills** — skill, subagent และกฎทำงานสำหรับ Claude Code (VS Code / CLI) เก็บไว้ที่เดียว แจกไปทุกเครื่องเป็น **Claude Code plugin** `mskills`

## เริ่มต้นบนเครื่องใหม่
1. ให้ git ในเครื่องเข้า repo นี้ได้ (repo เป็น private) — Windows: `gh auth login` แล้ว `gh auth setup-git`; Ubuntu/WSL: fine-grained token แบบ read-only + `git config --global credential.helper store` แล้ว `git clone` ครั้งหนึ่งให้มันจำ token
2. ติดตั้ง plugin:
   ```bash
   claude plugin marketplace add GotPatipan39/mskills
   claude plugin install mskills@mskills
   ```
   เครื่องที่ใช้ git ผ่าน HTTPS (ไม่ได้ตั้ง SSH key) ตั้ง `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` ก่อน — ใน VS Code ทำผ่าน `/plugin` → Marketplaces → ใส่ `GotPatipan39/mskills` ก็ได้
3. เปิดแชทใหม่ (หรือ `Ctrl+Shift+P` → **Developer: Reload Window**)

**เครื่องที่เคยใช้ installer เดิม** (ก่อน 2026-10-12) ต้องเก็บของเก่าออกก่อน ไม่อย่างนั้น skill เก่าใน `~/.claude/skills` จะบังตัวใน plugin โดยไม่มีคำเตือน และกฎจะซ้ำ 2 ชุด:
- ย้าย/ลบ `~/.claude/skills/<ชื่อ skill ของ mskills>` และ `~/.claude/agents/safety-reviewer.md`
- ลบบล็อก `<!-- BEGIN claude-skills ... -->` … `<!-- END claude-skills -->` ใน `~/.claude/CLAUDE.md`
- กฎ `ask` ของ git ที่ installer เคยใส่ใน `~/.claude/settings.json` ปล่อยไว้ได้ (ซ้ำกับของ plugin ไม่เสียหาย)

## plugin ส่งอะไรให้บ้าง
| ส่วน | มาจาก | ทำอะไร |
|---|---|---|
| skill ทั้งหมด | `skills/`, `vendor/mattpocock/` | แสดงเป็น `mskills:<ชื่อ>`; พิมพ์ `/tdd` หรือตารางที่ใช้ชื่อสั้นยังเรียกได้ |
| `safety-reviewer` | `agents/` | ต้องเรียกด้วยชื่อเต็ม `mskills:safety-reviewer` (ชื่อสั้นใช้กับ agent ใน plugin ไม่ได้) |
| กฎทุกโปรเจกต์ | `rules.md` ผ่าน hook `SessionStart` | ตาราง "งานไหนใช้ skill ไหน" + กฎความปลอดภัย — แทน `~/.claude/CLAUDE.md` เดิม; รันใหม่ตอน resume/clear/compact |
| ถามก่อนคำสั่ง git อันตราย | `hooks/mskills.ts` (`tool.check`) | `push`, `reset --hard`, `clean`, `branch -D`, `checkout -- / .`, `restore` ทั้ง Bash และ PowerShell — ถ้าตัวตรวจพังจะถามไว้ก่อน |

- Claude Code ไม่ให้ plugin ของผู้ใช้แก้ system prompt ตรงๆ (`prompt.compose` ถูกข้าม) กฎจึงส่งผ่าน `SessionStart` ซึ่งทดสอบแล้วว่าใช้ได้บน Windows รวม path ที่มีช่องว่าง
- กฎ `ask` ใน `settings.json` ส่งผ่าน plugin ไม่ได้ จึงทำเป็น hook `tool.check` แทน — test อยู่ใน `hooks/mskills.test.ts` (`claude plugin test .`)
- ผลทดสอบและเหตุผลที่เลือกแบบนี้: [docs/plugin-evaluation.md](docs/plugin-evaluation.md)

## โครงสร้าง
```
mskills/
├── .claude-plugin/        ← plugin.json + marketplace.json
├── skills/<ชื่อ>/         ← skill ของเราเอง (แก้ได้)
├── vendor/<ที่มา>/LICENSE ← skill จากภายนอก copy มาตรงๆ ห้ามแก้เนื้อหา
│   └── <ชื่อ>/               (ตอนนี้มี vendor/mattpocock/)
├── agents/<ชื่อ>.md       ← subagent ของเราเอง
├── hooks/                 ← hooks.json (กฎผ่าน SessionStart) + mskills.ts (ถามก่อน git อันตราย) + test
├── rules.md               ← กฎทุกโปรเจกต์ที่ Claude อ่านทุก session
├── docs/                  ← ผลทดสอบ/บันทึกการตัดสินใจของ repo นี้
└── README.md
```
ชื่อ skill ห้ามซ้ำกันระหว่าง `skills/` กับ `vendor/*/` เพราะ plugin รวมเป็นชุดเดียว

## แก้และอัปเดต
1. แก้ใน repo นี้ (หรือให้ Claude แก้) — skill: ขึ้นเวอร์ชันใน `SKILL.md` + `CHANGELOG.md` ของ skill นั้น และตารางด้านล่าง; เพิ่ม skill ใหม่: เพิ่มแถวในตาราง "ใช้ skill ตามงาน" ของ `rules.md` ด้วย
2. ทดสอบ: `claude plugin validate .` และ `claude plugin test .`; ลองของจริงก่อน push ได้ด้วย `claude --plugin-dir <path ของ repo>`
3. commit → push (plugin ไม่ใส่ `version` → ทุก commit คือรุ่นใหม่)
4. ทุกเครื่อง: `claude plugin marketplace update mskills && claude plugin update mskills@mskills` (หรือ `/plugin` → Marketplaces → ↻) แล้วเปิดแชทใหม่ — auto-update ของ Claude Code ยังไม่เห็นผลในการทดสอบ
5. แอป Claude: อัปโหลด zip ของ skill ที่เปลี่ยน (ดู "ใช้ในแอป Claude")

ถอยกลับเป็นรุ่นก่อน: `git revert` แล้ว push + อัปเดต หรือติดตั้ง installer รุ่นเก่าจากประวัติ git (ก่อน commit ที่ลบ `install/`)

## skill ของเราเอง (`skills/`)
| skill | เวอร์ชัน | ใช้กับ |
|---|---|---|
| `ros2-humble-cpp` | 3.2.1 | งาน ROS2 Humble + C++ |
| `modbus` | 1.1.0 | งาน Modbus RTU/TCP ทุกแบบ (C++, Node-RED, Python) |
| `industrial-ui` | 1.2.0 | UI/UX งานอุตสาหกรรม: HMI, dashboard, หน้า config (Web, Node-RED Dashboard, Grafana) |
| `project-readme` | 1.0.0 | เขียน/ปรับ README ของโปรเจกต์ให้ทีมบน GitLab อ่านเข้าใจ (ต้นแบบ: borunte-control) |
| `git-commit` | 1.1.3 | commit message (Conventional Commits + body อธิบายเหตุผล), ตรวจของที่ห้าม commit, release `vX.Y.Z` + CHANGELOG + tag |
| `tdd` | 1.0.0 | เขียน logic/แก้บั๊กแบบ test ก่อน (red → green → refactor) ทุกภาษา, mock ที่ขอบ hardware |
| `opencv` | 1.0.1 | machine vision ด้วย OpenCV (Python/C++, ROS2 node หรือโปรแกรมแยก): นับ/ตรวจชิ้นงาน, วัดขนาด, หาตำแหน่งให้ robot, QR/barcode, กล้อง UVC/industrial/depth/RTSP |

## subagent ของเรา (`agents/`)
Claude อีกตัวที่ Claude หลักส่งงานไปให้ทำ — มี context แยก (ไม่เห็นแชท) และจำกัด tool ได้ เหมาะกับงานตรวจที่ต้องการมุมมองคนนอก

| subagent | เวอร์ชัน | ใช้กับ | ถูกเรียกจาก |
|---|---|---|---|
| `safety-reviewer` | 1.0.0 | ตรวจ diff ก่อน commit ในโปรเจกต์ที่คุมเครื่องจักร: เกณฑ์ความปลอดภัยที่ถูกลด, ค่า hardware ที่เปลี่ยน, คำสั่งขยับที่ไม่มีเงื่อนไข, ตอนสื่อสารล้มเหลว, test ที่ถูกแก้ให้ผ่าน — อ่านอย่างเดียว | skill `git-commit` (ขั้นตอนที่ 2) หรือสั่งเอง: "ให้ safety-reviewer ตรวจ" / พิมพ์ `@` แล้วเลือก |

- เวอร์ชันอยู่ในบรรทัด `> เวอร์ชัน` ของไฟล์ agent; แก้แล้วขึ้นเลขในตารางนี้ และเขียนเหตุผลใน commit message
- Bash ของ `safety-reviewer` จำกัดแค่ด้วยคำสั่งในไฟล์ agent (อ่าน git อย่างเดียว) ไม่ใช่ด้วยระบบ — permissions และ hook ของ plugin ยังมีผลกับ subagent ตามปกติ

## skill จากภายนอก (`vendor/`, copy มาตรงๆ ไม่แก้เนื้อหา)
| skill | ที่มา | ใช้กับ | ใช้คู่กับ |
|---|---|---|---|
| `grilling` | mattpocock/skills (MIT, [`vendor/mattpocock/LICENSE`](vendor/mattpocock/LICENSE)) @ d81f3a1, 2026-09-29 | ซักถามแผนงาน/การออกแบบทีละรอบจนไม่มีอะไรค้าง | — |
| `grill-me` | เหมือนข้างบน | ตัวเรียก `grilling` (พิมพ์ `/grill-me`) | **`grilling`** |
| `domain-modeling` | เหมือนข้างบน | จดศัพท์โปรเจกต์ (`GLOSSARY.md`) และการตัดสินใจสำคัญ (`docs/adr/`) | — |
| `grill-with-docs` | เหมือนข้างบน | ซักถาม + จด GLOSSARY/ADR ไปพร้อมกัน (พิมพ์ `/grill-with-docs`) | **`grilling`** และ **`domain-modeling`** |
| `handoff` | mattpocock/skills (MIT) @ f3fc563, 2026-10-07 | สรุปแชทที่ยาวแล้วเป็นไฟล์ให้ session ใหม่ทำต่อ (พิมพ์ `/handoff` เท่านั้น Claude เรียกเองไม่ได้) — ไฟล์ไปอยู่ใน `%TEMP%` / `/tmp` ถ้าจะเก็บหรือเปิดจากเครื่องอื่นให้บอก path เช่น `/handoff เก็บไว้ที่ docs/` | — |

`grill-me` และ `grill-with-docs` เป็นแค่ตัวเรียก — plugin ส่งไปครบทั้งชุดอยู่แล้ว

## ข้อมูลเฉพาะโปรเจกต์
ข้อมูลเฉพาะโปรเจกต์ (address map, hardware, กฎเฉพาะเครื่อง) ให้เขียนใน `CLAUDE.md` ที่ root ของโปรเจกต์ ไม่ใส่ใน skill — ถ้าขัดกับ `rules.md` ให้ยึดของโปรเจกต์
การตัดสินใจสำคัญของโปรเจกต์ (ย้อนกลับยาก + คนอ่านทีหลังจะสงสัย + มีทางเลือกจริง) จดเป็น ADR ใน `docs/adr/` ของโปรเจกต์

## ใช้ในแอป Claude
skill ในแอป Claude ผูกกับบัญชี ไม่ได้อ่านจากโฟลเดอร์นี้ — ต้องอัปโหลดเองในหน้า Skills (`+ Add`)
- skill ที่มีหลายไฟล์ อัปโหลดเป็น `.zip` ของโฟลเดอร์ skill (คลิกขวาที่โฟลเดอร์ → Compress to ZIP) ไม่งั้นไฟล์ประกอบจะหาย
- `_upload/` เป็นที่พักไฟล์ zip สำหรับอัปโหลด ไม่เก็บใน git (อยู่ใน `.gitignore`)

## เช็กว่าเครื่องใช้รุ่นไหน
`claude plugin list` แสดง commit ที่ติดตั้ง (เช่น `Version: efdbaf748939`) เทียบกับ `git log` ของ repo นี้

## รับ skill จากภายนอก
ไม่ติดตั้งด้วย `npx skills add` หรือ `/plugin install` ของคนอื่นตรงๆ — ให้ Claude อ่านก่อนทุกครั้ง แล้วเลือกอย่างใดอย่างหนึ่ง:
- **copy มาตรงๆ** (ตาราง "skill จากภายนอก") เมื่อเนื้อหาดีและไม่ขัดกับหลักของเรา — วางไว้ที่ `vendor/<ที่มา>/<ชื่อ>/` พร้อม `vendor/<ที่มา>/LICENSE` ไฟล์เดียว, บันทึกที่มา, commit/วันที่, license (vendor ที่มาใหม่ต้องเพิ่ม path ใน `skills` ของ `.claude-plugin/plugin.json`)
- **ดัดแปลงเข้า skill ของเรา** เมื่อดีบางส่วน — บันทึกใน CHANGELOG ว่าเอาอะไรมาจากไหน และไม่เอาอะไรเพราะอะไร
- **ไม่ใช้** — จดเหตุผลไว้ด้านล่าง กันพิจารณาซ้ำ

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
| omer-metin/skills-for-antigravity `ros2-robotics` | ไม่ใช้ — description เสีย (`Use when ", " mentioned.`), เนื้อหาบางส่วนผิด, น่าจะสร้างอัตโนมัติ |
| arpitg1304/robotics-agent-skills `docker-ros2-development` | ไม่ใช้ตอนนี้ — เนื้อหาดี แต่ยังไม่ใช้ Docker (WSL + mini PC + PM2 พอ) พิจารณาใหม่เมื่อต้อง deploy หลายเครื่อง/แบบ offline |
| vercel-labs/agent-browser `agent-browser` | ไม่ใช้ — เป็น stub ต้องติดตั้ง CLI + Chrome, description กว้างเกิน, ส่วนใหญ่ไม่เกี่ยว (Slack, Vercel, AWS) ทดสอบ UI ใช้ Playwright แทน |
| vercel-labs/skills `find-skills` | ไม่ใช้ — ต้องใช้ internet และให้ติดตั้ง skill เองแบบข้ามการยืนยัน (`-y`) ขัดกับขั้นตอนตรวจข้างบน (นำเกณฑ์คัดคุณภาพมาใส่ข้อ 7) |
| anthropics/skills `frontend-design` | บางส่วน — ไม่ copy (เน้นดีไซน์แปลกใหม่ ขัดกับ HMI) ดัดแปลงเข้า `industrial-ui` 1.1.0 |
| arpitg1304 `ros2`, dbwls99706 `ros2-engineering-skills` | บางส่วน — คัด references / ดัดแปลงเข้า `ros2-humble-cpp` 2.0.0 |
| arpitg1304 `ros2-web-integration` | บางส่วน — ดัดแปลงเข้า `industrial-ui` 1.2.0 (แก้ watchdog teleop และการตั้ง parameter) |
| github/awesome-copilot `create-readme` | ไม่ใช้ — สั้นมาก (21 บรรทัด), ต้องโหลด README ตัวอย่าง 4 ไฟล์จาก internet ทุกครั้ง, เน้น README โปรเจกต์ open source ไม่ใช่งานเครื่องจักร; ส่วนที่ดี (กระชับ, ไม่ซ้ำกับ LICENSE/CHANGELOG, ใช้ GitHub admonition) จดไว้ใช้ถ้าทำ skill README ของเราเอง |
| github/awesome-copilot `git-commit` @ 143a3d9 | บางส่วน — ดัดแปลงเข้า `git-commit` 1.0.0: เอาตาราง type ของ Conventional Commits และกฎความปลอดภัยของ git; ที่ไม่เอา: `allowed-tools: Bash` (รัน Bash ทุกคำสั่งได้โดยไม่ถามระหว่างที่ skill ทำงาน), แนะนำ `git add -p` (interactive ใช้ใน Claude Code ไม่ได้), ไม่มีเรื่องระดับการทดสอบและสิ่งที่ห้าม commit (IP/ค่าเครื่องจริง) |
| mattpocock/skills `git-guardrails-claude-code` @ d81f3a1 | ไม่ใช้ — hook ใช้ `jq` ซึ่งไม่มีบน Windows เครื่องนี้ ทดสอบแล้ว hook ไม่บล็อกอะไรเลยและไม่เตือน, ดักแค่ Bash ไม่ดัก PowerShell tool, บล็อก `git push` ทั้งหมด, จับคำสั่งด้วย regex หลวมจนข้อความใน commit message ก็โดน; ตอนนี้ใช้ hook `tool.check` ใน `hooks/mskills.ts` แทน (ไม่ต้องใช้ jq, ดักทั้ง Bash และ PowerShell, ถามแทนบล็อก) |
| anthropics/skills `skill-creator` @ 8a1541c (Apache-2.0) | ไม่ใช้ — ไม่ copy เข้า repo: มีฉบับที่ซิงก์จากบัญชี claude.ai (`anthropic-skills:skill-creator`) ในเครื่องอยู่แล้ว เรียกใช้ได้เมื่อต้องการ; หลักการเขียน skill (อธิบายเหตุผลแทน MUST, SKILL.md < 500 บรรทัด, แยก references, สัมภาษณ์ก่อนเขียน) เราทำอยู่แล้ว; description แบบ "pushy" ขัดข้อ 4; `run_loop.py` ปรับ description ใช้บน Windows ไม่ได้ (`select()` บน pipe → นับทุก query เป็นไม่ trigger โดยไม่ error, ไม่ระบุ encoding → พังกับภาษาไทย cp874) และต้องมี `claude` CLI + เรียก `claude -p` ราว 360 ครั้งต่อ skill; viewer โหลด Google Fonts/SheetJS จาก CDN และ kill ทุก process บน port 3117; ส่วนที่มีประโยชน์ (รันเทียบมี/ไม่มี skill ด้วย subagent) ทำได้โดยไม่ต้องติดตั้งอะไร |
| obra/superpowers `using-git-worktrees` @ 8ca22db | ไม่ใช้ — description กว้างจนทำงานทุกครั้งที่เริ่ม feature, รัน `npm/pip/poetry install` เอง (ต้องใช้ internet, ไม่รองรับ colcon), ROS2 ต้อง build แยกทุก worktree และรันพร้อมกันจะแย่ง `/dev/ttyUSB*`; Claude Code มี worktree ในตัวอยู่แล้ว |
| mattpocock/skills `tdd` @ 3f59913 (MIT) | บางส่วน — ดัดแปลงเป็น `tdd` 1.0.0 ของเรา: เอาการตกลง seam ก่อนเขียน test, anti-pattern (tautological, ผูกกับ implementation, horizontal slicing), mock เฉพาะขอบระบบ; ไม่ copy ตรงๆ เพราะเรียก skill `codebase-design` และ `code-review` ของเขาที่เราไม่มี (`code-review` จะไปชนกับ `/code-review` ของ Claude Code), ตัวอย่างเป็น TypeScript/checkout ทั้งหมด, ไม่พูดถึง hardware; ใส่ refactor กลับเข้าลูป |
| tondevrel/scientific-agent-skills `opencv` @ 6e89d9e (MIT แต่ frontmatter เขียน Apache-2.0) | ไม่ใช้ — เขียน `opencv` 1.0.0 ของเราเองแทน: เป็นคู่มือ cv2 แบบ notebook (Python อย่างเดียว, `imshow` ทุกตัวอย่าง, `pip install opencv-python` ซึ่งชนกับ OpenCV 4.5.4 ของ Humble/cv_bridge); ผิด: บอกว่า SIFT อยู่ใน contrib (ย้ายเข้า main ตั้งแต่ 4.4), วาดกรอบ QR ผิด shape ของ 4.x, threaded capture ใช้ queue 128 เฟรม (ภาพช้าสะสม) และ release ข้าม thread; description อ้างว่ามี calibration/DNN แต่ไม่มีเนื้อหา; ไม่มี C++, cv_bridge, กล้อง industrial/depth, pixel→mm; ทั้ง repo 72 skill มาใน commit เดียวไม่เคยอัปเดต |
| anthropics/claude-code plugin-dev `Plugin Structure`, `Plugin Settings` @ 3deb873 | ไม่ใช้ — license "All rights reserved" (Commercial Terms) copy ลง vendor ไม่ได้; หลายจุดเก่ากว่าที่ทดสอบกับ Claude Code 2.1.296: `hooks.json` ไม่ครอบด้วย `{"hooks": ...}`, ชื่อ skill มีช่องว่าง (ชื่อสั้นใช้เรียกไม่ได้), agent ไม่มี `name` และใช้ `capabilities:`, บอกว่าชื่อซ้ำจะ error (จริงคือ `~/.claude/skills` บังตัวใน plugin เงียบๆ), ไม่พูดถึง prefix `plugin:` ของ agent, เน้น `commands/`; script ตัวอย่างใช้ `jq`; ที่นำมาใช้: matcher ของ `SessionStart` (`startup/resume/clear/compact`), ใส่ `timeout` ให้ hook, quote `${CLAUDE_PLUGIN_ROOT}`; ไม่ใส่ `version` แล้วติดตาม commit ตาม docs (ทดสอบแล้ว ไม่ใช่ 0.1.0 อย่างที่ skill นี้บอก) |
