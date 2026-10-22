# ดูแลและพัฒนา gppi

สำหรับคนที่แก้ repo นี้ — ผู้ใช้ทั่วไปไม่ต้องอ่าน
ทีมเสนอแก้ผ่าน issue / pull request — เจ้าของ repo เป็นคน merge และออก release

## แก้ skill หรือ agent
- **skill**: แก้ใน `skills/<ชื่อ>/` แล้วขึ้นเวอร์ชันในบรรทัด `> เวอร์ชัน` ของ `SKILL.md` + `CHANGELOG.md` ของ skill นั้น + ตาราง skill ใน [README](../../README.md#skill-และ-subagent) — commit แบบ `<skill> vX.Y.Z: <สรุป>`
- **skill ใหม่**: เพิ่มแถวในตาราง "ใช้ skill ตามงาน" ของ [`rules.md`](../../rules.md) ด้วย ไม่อย่างนั้น Claude ไม่รู้ว่าต้องโหลดเมื่อไหร่
- **agent**: เวอร์ชันอยู่ในบรรทัด `> เวอร์ชัน` ของไฟล์ agent; แก้แล้วขึ้นเลขในตาราง README และเขียนเหตุผลใน commit message
- `safety-reviewer` **ไม่มี Bash** (ตั้งแต่ 1.1.0) — plugin subagent ใช้ `permissionMode`/`hooks` ใน frontmatter ไม่ได้ การห้ามในข้อความจึงบังคับไม่ได้จริง ทางเดียวที่บังคับได้คือไม่ให้ tool นั้น; ผู้เรียกเขียน diff ไว้ที่ `.git/gppi-review.diff` ให้แทน — ห้ามเพิ่ม Bash กลับโดยไม่มีทางจำกัดที่ระบบบังคับ
- skill ที่มีไฟล์ `LICENSE` ของตัวเอง (`grilling`, `domain-modeling`) มาจากภายนอก — **ห้ามแก้เนื้อหา** อัปเดตด้วยการ copy จากต้นทางใหม่ทั้งไฟล์
- แก้ตัวกันคำสั่ง: ดู [GUARD.md](../GUARD.md#แก้ตัวกัน)

## ทดสอบ
```bash
claude plugin validate . --strict
claude plugin test .                 # test ของตัวกันคำสั่ง (hooks/gppi.test.ts)
claude --plugin-dir .                # ลองของที่แก้แต่ยังไม่ release — ปิด gppi ที่ติดตั้งไว้ก่อน ไม่อย่างนั้นจะโหลดซ้ำ
bash dev/test-skill-code.sh         # โค้ด template ที่คุม hardware ใน skill (ramp, watchdog, Modbus client) — รันใน WSL/Ubuntu
node dev/check-links.mjs             # ลิงก์ในเอกสารทั้ง repo — ย้าย/เปลี่ยนชื่อไฟล์แล้วต้องรัน
```
`dev/test-skill-code.sh` ต้องมี `g++ libgtest-dev libmodbus-dev` (Ubuntu: `sudo apt-get install -y g++ libgtest-dev libmodbus-dev`) — ไม่ต้องมี ROS2 และไม่แตะอุปกรณ์จริง (Modbus server จำลองบน 127.0.0.1); แก้ template ที่คุม hardware ต้องเพิ่ม test ที่แดงก่อนแก้ (skill `tdd`)
CI ([`.github/workflows/validate.yml`](../../.github/workflows/validate.yml)) รัน validate + test + hook ใต้ node 22.18.0 ทุก PR และทุก push ขึ้น main — ถ้า Claude Code รุ่นใหม่ทำให้ตัวกันพัง ควรแดงที่นี่ก่อนถึงเครื่องทีม

### eval การเลือก skill
[`dev/evals/`](../../dev/evals/) มี 20 case: 15 case วัดว่า Claude โหลด skill ถูกตัวไหม (tag `selection`): 10 case ต่อ skill (รวมอุปกรณ์ Modbus ที่ไม่มีไฟล์ใน `devices/`), 2 case ที่ต้องโหลดสองตัว (modbus + tdd, ros2 + modbus), 3 case ที่ต้องไม่โหลด (คำถามทั่วไป, แปลภาษา, script ใช้ครั้งเดียว — ต้องไม่ดึง `tdd`/`modbus`) และ 5 case วัดพฤติกรรม (tag `behavior`, ใช้กรรมการ LLM): แก้ UI ต้องเสนอ mockup ก่อน / แก้คำผิดไม่ต้อง / logic แบบ sequence ต้องเสนอ flowchart draw.io ก่อน / งานใหญ่ต้องเสนอเริ่มจาก grill แล้วรอ / แตก ticket ต้องมี ticket 00 ระบบตรวจ (ฟังก์ชันแปลงค่าและ script ใช้ครั้งเดียวต้องไม่ดึง `flowchart`) — รันเมื่อแก้ `description` ของ skill หรือกฎใน `rules.md`
```bash
claude plugin eval . --ablation none --disallow-tools Agent --no-publish --runs 3
claude plugin eval . --case modbus-and-tdd --runs 1 --ablation none --disallow-tools Agent --no-publish   # case เดียว
```
- `--ablation none` จำเป็น: ค่าเริ่มต้นรันแบบไม่มี plugin เทียบด้วย และในโหมดนั้นตัวตรวจ `tool: Skill` ไม่ถูกนับคะแนน
- ใช้ credential ของคนรัน — 16 case × 1 รอบ ≈ $3.2 (วัด 2026-10-15 ผ่าน 16/16 กับ Claude Code 2.1.299) — ถ้าชน usage limit case จะได้ 0 พร้อม error "session limit" ไม่ใช่เลือก skill ผิด ให้ดู `error` ใน JSON ก่อน; `--runs 3` ราว 3 เท่า ใส่ `--max-cost-usd` ถ้าต้องการเพดาน
- case ใช้ได้แค่ `Read, Glob, Grep, Skill` (ไม่มี Bash/Write) และ `--disallow-tools Agent` กัน subagent — eval จึงสั่งอะไรไม่ได้ แต่ hook ของ plugin ทำงานจริง (นอก sandbox) ห้ามเพิ่ม `--allow-tools Bash` และ**ห้ามรันบนเครื่องที่ต่อ PLC/serial**
- `--no-publish` กันไม่ให้ report ขึ้น claude.ai; ผลอยู่ใน `dev/evals/results/` (อยู่ใน `.gitignore`)
- ยังไม่อยู่ใน CI เพราะต้องมี API key และมีค่าใช้จ่ายทุกครั้ง
- case ใหม่: `claude plugin eval init --bare <ชื่อ>` — prompt ต้องเป็นคำขอแบบที่ทีมพิมพ์จริง ไม่เอ่ยชื่อ skill

กฎ (`rules.md`) และ hook โหลดตอนเริ่ม session — ทดสอบต้อง **เปิดแชทใหม่** (`/reload-plugins` ไม่รัน SessionStart ซ้ำ)
เวลาทดสอบใน session จริง ให้ยืนยันผลจาก log (`~/.claude/projects/<project>/<session>.jsonl`: `permission-mode`, `permissionDecision`) ไม่ใช่จากที่ Claude ใน session นั้นบอก — Claude มองไม่เห็น prompt ฝั่งผู้ใช้

## ออกเวอร์ชัน
ทำตาม skill `git-commit` หัวข้อ "ข้อยกเว้น: repo gppi" — สรุป:
1. เลขอยู่ที่ [`.claude-plugin/plugin.json`](../../.claude-plugin/plugin.json) (`"version"`) **ที่เดียว**
2. เพิ่มหัวข้อใน [`CHANGELOG.md`](../../CHANGELOG.md) — เขียนให้คนที่จะอัปเดตเครื่องอ่าน พร้อมระดับการทดสอบ
3. validate + test ต้องผ่าน
4. commit `vX.Y.Z: <สรุป>` แล้ว `claude plugin tag .` (ได้ tag `gppi--vX.Y.Z`)
5. push ทั้ง main และ tag

**ทีมได้ของใหม่ก็ต่อเมื่อเลข `version` เปลี่ยน** — push ขึ้น main อย่างเดียวไม่ไปถึงเครื่องใคร ตั้งใจให้เป็นแบบนี้ เพื่อไม่ให้งานที่ยังไม่เสร็จไปถึงเครื่องที่คุม hardware
เครื่องที่เปิด auto-update จะได้รุ่นใหม่เอง (ทดสอบแล้วกับ 0.1.0 → 0.1.1) และใช้ใน session ถัดไป

ถอยกลับเป็นรุ่นก่อน: `git revert` แล้วออกเวอร์ชันใหม่ — เลขต้องขึ้นเสมอ ไม่ย้อนเลข

## การตัดสินใจ
- [ADR-0001](adr/0001-single-team-plugin.md) — plugin ก้อนเดียว ไม่แยกตามโดเมน เพื่อให้กฎความปลอดภัยติดไปทุกเครื่อง
- [ADR-0003](adr/0003-guard-hook-plus-mod.md) — ตัวกันคำสั่งเป็น PreToolUse hook (node) ซ้อนกับ mod เพราะใน auto mode `ask` ของ mod ถูก classifier อนุมัติแทนคน (แทน [ADR-0002](adr/0002-guard-as-mod.md))
- ผลทดสอบตอนย้ายจาก skill ธรรมดามาเป็น plugin และผลทดสอบตัวกัน: [plugin-evaluation.md](plugin-evaluation.md)

## รับ skill จากภายนอก
ไม่ติดตั้งด้วย `npx skills add` หรือ `/plugin install` ของคนอื่นตรงๆ — ให้ Claude อ่านก่อนทุกครั้ง แล้วเลือกอย่างใดอย่างหนึ่ง:
- **copy มาตรงๆ** เมื่อเนื้อหาดีและไม่ขัดกับหลักของเรา — วางไว้ที่ `skills/<ชื่อ>/` พร้อมไฟล์ `LICENSE` ของต้นทางในโฟลเดอร์เดียวกัน, บันทึกที่มา, commit/วันที่, license ในตาราง skill ของ README
- **ดัดแปลงเข้า skill ของเรา** เมื่อดีบางส่วน — บันทึกใน CHANGELOG ว่าเอาอะไรมาจากไหน และไม่เอาอะไรเพราะอะไร และเพิ่มแถว + ข้อความ license ของต้นทางใน [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md) (แปล/เรียบเรียงใหม่ก็ยังนับเป็นงานดัดแปลง — ไม่ต้องตัดสินว่าเอามามากพอจะเป็น "substantial portions" ไหม)
- **ไม่ใช้** — จดเหตุผลไว้ในตารางข้างล่าง กันพิจารณาซ้ำ

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
| mattpocock/skills `to-spec`, `to-tickets`, `retro` @ 5beb35b (MIT) | `to-spec` + `to-tickets` ดัดแปลงรวมเป็น `spec-tickets` 1.0.0 (เก็บเป็นไฟล์ในโปรเจกต์ เพิ่มความปลอดภัย/ค่า hardware/ระดับการทดสอบ) — copy ตรงไม่ได้เพราะพึ่ง `/setup-matt-pocock-skills` และ `writing-for-agents` ของเขา; `retro` ไม่รับตอนนี้ (ซ้ำกับการจดสิ่งที่เรียนรู้ของ `project-claude-md`, เน้น CODING_STANDARDS/linter ที่ทีมยังไม่ใช้) |
| anthropics/claude-plugins-official `claude-md-improver` @ c2bdb42 (Apache-2.0) | บางส่วน — ดัดแปลงเข้า `project-claude-md` 1.1.0: ตรวจว่ายังตรงกับโค้ด (ทำเป็นตัวตรวจ pointer `ไฟล์`: `KEY`), รายงานก่อนแก้, diff พร้อมเหตุผล, เก็บความรู้ท้ายงาน — ไม่ติดตั้งตัวนั้นเพิ่ม: ทั้งสองตัวถูกเรียกจากคำว่า "CLAUDE.md" จะแย่งกันจนไม่รู้ว่าได้ตัวไหน, เป็นคำแนะนำทั่วไปภาษาอังกฤษไม่รู้เรื่องเครื่อง (ค่า hardware, อะไรทำให้ขยับ, ป้าย ✅/⚠️/❓), คะแนน A–F ไม่ช่วยตัดสินใจอะไร, เคล็ดลับบางข้อยังไม่ได้ตรวจกับ Claude Code รุ่นปัจจุบัน (ชื่อไฟล์ `.claude.local.md`, ปุ่ม `#`) |
| Agents365-ai/drawio-skill @ 5727082 (MIT) | บางส่วน — ดัดแปลงเข้า `flowchart` 1.1.0: ตรวจกล่องทับกัน/เส้นวิ่งทับกล่อง/เส้นตัดกันจากพิกัด (เฉพาะเส้นที่มีจุดหัก), ห้ามใช้ id 0/1, เส้นต้องมี mxGeometry, `--layout verticalFlow` และ Mermaid → `.drawio` ของ draw.io ≥ 30, export ไว้ดูเองไม่ใส่ `-e`, ดูรูปแก้ไม่เกิน 2 รอบ — ไม่ copy ทั้งตัว: ใหญ่มาก (script Python ~16,000 บรรทัด + MCP server) ต้องมี python3 ซึ่งเครื่อง Windows ของทีมไม่มี, `allowed-tools: Bash` ไม่จำกัด, `disable-model-invocation` (Claude โหลดเองไม่ได้), เน้น diagram สถาปัตยกรรม/cloud ไม่ใช่ logic ของเครื่อง |
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
