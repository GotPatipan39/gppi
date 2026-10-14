# CHANGELOG — gppi

เวอร์ชันของทั้ง plugin (เลขใน `.claude-plugin/plugin.json`) — ทีมได้ของใหม่เมื่อเลขนี้เปลี่ยนเท่านั้น
การเปลี่ยนของ skill แต่ละตัวอยู่ใน `skills/<ชื่อ>/CHANGELOG.md`

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
