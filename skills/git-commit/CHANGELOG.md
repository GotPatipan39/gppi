# CHANGELOG — git-commit

## 1.1.0 — 2026-10-08
- โปรเจกต์ที่คุมเครื่องจักร: หลัง stage เรียก subagent `safety-reviewer` ตรวจ diff ก่อน commit — 🔴 หยุดรอผู้ใช้, 🟡 ถามก่อน commit; ไม่มี agent ในเครื่อง → ตรวจเองตามตารางและบอกผู้ใช้
- เหตุผล: ตารางตรวจเดิมให้ Claude ที่เขียนโค้ดตรวจงานตัวเอง ซึ่งมักมองข้ามสิ่งที่ตั้งใจแก้ ตัวตรวจที่ไม่เห็นแชทอ่านแบบคนนอก

## 1.0.0 — 2026-10-02
- เวอร์ชันแรก: commit แบบ Conventional Commits ที่ body อธิบายเหตุผล/กลไก/ตัวเลขที่วัด (ต้นแบบ: history ของ fg-robot-pallet), ตรวจของที่ห้าม commit, เสนอการแยก diff ที่ปนกัน
- release: เลขเดียวทั้งโปรเจกต์, นับ major/minor/patch ตามผลต่อหน้างาน, CHANGELOG.md ที่ root เขียนให้คนอัปเดตเครื่องอ่าน, บรรทัด Tested, แก้เลขทุกไฟล์ให้ตรงกัน, annotated tag, ถามก่อน push
- type `tune` (ปรับค่า parameter/timing) และการหาเวอร์ชันล่าสุดจาก commit `vX.Y.Z` ที่ไม่มี tag — ทั้งสองอย่างเจอตอนซ้อม release กับ fg-robot-pallet
- ข้อยกเว้นสำหรับ repo mskills: release ราย skill ไม่มี tag
- ดัดแปลงจาก github/awesome-copilot `git-commit` @ 143a3d9 (MIT): ตาราง type และกฎความปลอดภัยของ git — ไม่เอา `allowed-tools: Bash` (รัน Bash ได้ทุกคำสั่งโดยไม่ถาม) และ `git add -p` (interactive ใช้ใน Claude Code ไม่ได้)
