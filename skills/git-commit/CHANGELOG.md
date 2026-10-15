# CHANGELOG — git-commit

## 1.3.1 — 2026-10-15
- เอกสารตามโค้ด: logic ที่มี flowchart ใน `docs/flowcharts/` เปลี่ยนแต่ `.drawio` ไม่อยู่ใน diff → ตรวจ/เสนอแก้ก่อน commit (กฎใหม่ใน rules.md)

## 1.3.0 — 2026-10-14
- breaking change: `!` + footer `BREAKING CHANGE: <ต้องทำอะไร>` สำหรับการเปลี่ยนที่เครื่องต้องทำตาม; ตอน release หา commit พวกนี้ → major (0.x ขึ้น minor ได้) และ footer กลายเป็นบรรทัด "⚠ ติดตั้ง"
- ก่อน commit: diff เปลี่ยนพฤติกรรมที่คนเห็นแต่ไม่มี README/CLAUDE.md → อ่านแล้วเสนอแก้ในงานเดียวกัน (ตาม rules.md)
- ไม่แยก release ออกเป็น skill `disable-model-invocation` — ผู้ใช้สั่ง "ออกเวอร์ชัน" เป็นภาษาธรรมดา ถ้า Claude โหลด skill เองไม่ได้จะทำ release เองโดยไม่มีขั้นตอน (แย่กว่า); "ทำเฉพาะเมื่อผู้ใช้สั่ง" + ถามก่อน push พอแล้ว

## 1.2.1 — 2026-10-14
- `safety-reviewer` 1.1.0 ไม่มี Bash แล้ว → ก่อนเรียกต้องเขียน diff ไว้ที่ `.git/gppi-review.diff` แล้วส่ง path ไปให้; diff ใหญ่ให้แบ่งส่ง
- ไม่มีตัวตรวจในเครื่อง → ต้องบอกผู้ใช้ **ก่อน** commit ว่าไม่ได้ผ่านตัวตรวจแยก

## 1.2.0 — 2026-10-14
- ย้ายจาก mskills มาเป็น plugin `gppi`: เรียกตัวตรวจด้วย `gppi:safety-reviewer` ชื่อเดียว (เลิกใช้ installer แล้ว)
- ข้อยกเว้นของ repo gppi: เพิ่มการ release ทั้ง plugin — เลขใน `plugin.json`, CHANGELOG ที่ root, validate/test ก่อน, tag ด้วย `claude plugin tag`

## 1.1.2 — 2026-10-12
- ข้อยกเว้น repo mskills: installer ย้ายไป `install/install-skills.ps1`; เพิ่มคำสั่งอัปเดตสำหรับเครื่องที่ใช้ plugin

## 1.1.1 — 2026-10-12
- เรียกตัวตรวจได้ทั้ง `safety-reviewer` (ติดตั้งด้วย installer) และ `mskills:safety-reviewer` (ติดตั้งเป็น plugin) — ทดสอบแล้วว่า agent ใน plugin เรียกด้วยชื่อสั้นไม่ได้ ได้ error "not found" แล้วอาจตกไปข้อ "ไม่มีตัวตรวจ → ตรวจเอง" ซึ่งข้ามตัวตรวจแยกไปเงียบๆ

## 1.1.0 — 2026-10-08
- โปรเจกต์ที่คุมเครื่องจักร: หลัง stage เรียก subagent `safety-reviewer` ตรวจ diff ก่อน commit — 🔴 หยุดรอผู้ใช้, 🟡 ถามก่อน commit; ไม่มี agent ในเครื่อง → ตรวจเองตามตารางและบอกผู้ใช้
- เหตุผล: ตารางตรวจเดิมให้ Claude ที่เขียนโค้ดตรวจงานตัวเอง ซึ่งมักมองข้ามสิ่งที่ตั้งใจแก้ ตัวตรวจที่ไม่เห็นแชทอ่านแบบคนนอก

## 1.0.0 — 2026-10-02
- เวอร์ชันแรก: commit แบบ Conventional Commits ที่ body อธิบายเหตุผล/กลไก/ตัวเลขที่วัด (ต้นแบบ: history ของ fg-robot-pallet), ตรวจของที่ห้าม commit, เสนอการแยก diff ที่ปนกัน
- release: เลขเดียวทั้งโปรเจกต์, นับ major/minor/patch ตามผลต่อหน้างาน, CHANGELOG.md ที่ root เขียนให้คนอัปเดตเครื่องอ่าน, บรรทัด Tested, แก้เลขทุกไฟล์ให้ตรงกัน, annotated tag, ถามก่อน push
- type `tune` (ปรับค่า parameter/timing) และการหาเวอร์ชันล่าสุดจาก commit `vX.Y.Z` ที่ไม่มี tag — ทั้งสองอย่างเจอตอนซ้อม release กับ fg-robot-pallet
- ข้อยกเว้นสำหรับ repo mskills: release ราย skill ไม่มี tag
- ดัดแปลงจาก github/awesome-copilot `git-commit` @ 143a3d9 (MIT): ตาราง type และกฎความปลอดภัยของ git — ไม่เอา `allowed-tools: Bash` (รัน Bash ได้ทุกคำสั่งโดยไม่ถาม) และ `git add -p` (interactive ใช้ใน Claude Code ไม่ได้)
