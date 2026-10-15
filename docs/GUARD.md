# ตัวกันคำสั่ง — ทำงานอย่างไร

เอกสารนี้สำหรับคนที่อยากรู้ว่าตัวกันจับอะไร ไม่จับอะไร และทำไมถึงทำแบบนี้ — ถ้าแค่จะใช้งาน อ่านหัวข้อ [ความปลอดภัย](../README.md#ความปลอดภัย) ใน README พอ

## หน้าที่ของมัน
ก่อน Claude รันคำสั่งใน Bash หรือ PowerShell ตัวกันจะดูว่าคำสั่งนั้นอาจทำให้เครื่องจักรขยับ แย่ง bus หรือลบงาน git ที่ย้อนกลับยากหรือเปล่า ถ้าใช่ จะ **หยุดให้คนกดยืนยันก่อน** — ไม่บล็อก

ตัวกันเป็นแค่ด่านหนึ่งในสามด่าน:

| ด่าน | อยู่ที่ | ทำอะไร |
|---|---|---|
| กฎ | [`rules.md`](../rules.md) — ส่งเข้าทุก session ตอนเริ่ม | สั่ง Claude ว่าห้ามรันคำสั่งที่ทำให้เครื่องขยับถ้าผู้ใช้ไม่ได้สั่ง, ห้ามเดาค่า hardware, ห้ามลดเกณฑ์ความปลอดภัย |
| ตัวกันคำสั่ง | [`hooks/`](../hooks/) | หยุดถามคนก่อนรันคำสั่งในรายการข้างล่าง |
| ตัวตรวจ diff | [`agents/safety-reviewer.md`](../agents/safety-reviewer.md) | ตรวจโค้ดก่อน commit หาเกณฑ์ความปลอดภัยที่ถูกลด, ค่า hardware ที่เปลี่ยน |

## คำสั่งที่ถามก่อนรัน

| กลุ่ม | คำสั่ง |
|---|---|
| ROS2 | `topic pub`, `service call`, `action send_goal`, `launch`, `run`, `param set/load`, `lifecycle set`, `control switch_controllers/set_controller_state/load_controller`, `bag play`, `component load` |
| service | `systemctl start/stop/restart/reload/kill/isolate`, `enable/disable/mask --now`, `service ... restart`, `pm2 start/stop/restart/reload/delete/resurrect`, `pm2-runtime` |
| bus (Modbus / serial) | `mbpoll`, `modpoll`, serial terminal (`minicom`, `picocom`, `tio`, `miniterm` ...) และคำสั่งใดก็ตามที่แตะ `/dev/<device>` ที่ไม่ใช่ device ทั่วไป — รวม symlink ของ udev อย่าง `/dev/motor_controller`; ยกเว้น `ls`, `udevadm`, `dmesg`, `stat`, `readlink`, `test` |
| Node-RED | deploy flow (POST/PUT ไปที่ `/flow(s)`), กด inject (`/inject/<id>`), เปิด runtime (`node-red`, `npx node-red`, `node-red-start/restart/stop`) |
| container | docker, podman, nerdctl: `compose up/start/restart/stop/down/kill/run`, `run/start/restart/stop/kill/pause`, `rm -f` — ดู `ps/logs/exec/build` ไม่ถาม |
| python ที่สั่ง bus ในบรรทัดคำสั่ง | `python`/`py` ที่มีโค้ดอยู่ในคำสั่งเอง (`-c`, heredoc, pipe) และมี `pymodbus`, `minimalmodbus`, `pyModbusTCP`, `Serial(`, `write_register/coil` |
| หยุด process / ปิดเครื่อง | `pkill`, `killall`, `reboot`, `shutdown`, `poweroff`, `halt`, `init 0/6`, `systemctl reboot/poweroff`, `wsl --shutdown/-t`; Windows: `taskkill`, `Stop-Process`, `Start/Stop/Restart-Service`, `sc`/`nssm stop/start/restart`, `Restart/Stop-Computer` |
| COM port ฝั่ง Windows | `usbipd attach/detach` (ดึง USB-RS485 ไป/กลับ WSL), `mode COM<n>` |
| git ที่ย้อนกลับยาก | `push`, `reset --hard`, `clean`, `branch -D`, `checkout -- / .`, `restore` |
| MCP tool (ตั้งแต่ v0.1.8) | tool ใดก็ได้ของ MCP server ใดก็ได้ ที่ชื่อมีคำว่า `write`, `publish`, `call`, `send`, `goal`, `cancel`, `safe`, `deploy`, `inject`, `merge`, `push`, `create`, `update`, `delete`, `remove`, `set`, `start`, `stop`, `restart`, `play`, `retry`, `trigger`, `run`, `reset`, `install`, `upload`, `move`, `jog`, `enable`, `disable` — ยกเว้นชื่อที่ขึ้นต้นด้วยคำอ่าน (`get_`, `list_`, `read_`, `search_`, `query_` ...) |

## ตั้งใจให้เป็นแบบนี้
- **ถาม ไม่บล็อก** — งานทดสอบเครื่องหน้างานต้องรันคำสั่งพวกนี้จริง
- **ไม่ยกเว้นงาน simulator** — จากบรรทัดคำสั่งแยกไม่ออกว่า `ros2 launch` ต่อ driver จริงหรือไม่
- **เปิด bus = ถาม แม้แค่อ่าน** — เปิด RS-485 ที่ระบบใช้อยู่จะชนกับ master ตัวเดิมบน bus
- **หยุด process = ถาม** — driver ที่หยุดกลางคำสั่งโดยไม่มี watchdog ทำให้เครื่องค้างค่าสุดท้าย (`kill <pid>` ไม่ถาม เพราะ Claude ใช้หยุด process ที่ตัวเองเปิด)
- **จับทุกตำแหน่งในบรรทัด** — จาก Windows มักรันผ่าน `wsl -- bash -lc "... ros2 launch ..."`
- **คำที่เป็นภาษาธรรมดาด้วย** (`shutdown`, `halt`, `node-red`) ถามเฉพาะตอนอยู่ตำแหน่งคำสั่ง — รวมหลัง `sudo`, `ssh host`, `wsl --`, `cmd /c`, `powershell -Command`, `do`/`then`, `xargs` — ไม่ถาม `git commit -m "fix safe shutdown"`, `grep -rn shutdown`, topic `/halt`
- **ถามเกินโดยตั้งใจ** กับคำเหล่านั้นที่อยู่ต้น quote (`grep "shutdown"`) — เพราะต้องจับ `bash -lc "sudo reboot"` ที่หน้าตาเหมือนกัน
- **ไม่ผ่อน `deny`** ที่ระบบตัดสินไว้แล้ว และถ้าตัวกันเองทำงานผิดพลาดจะ **ถาม** แทนการปล่อยผ่าน

## สิ่งที่ผู้ใช้จะเห็น
- **CLI** แสดง `Hook PreToolUse:Bash requires confirmation ... gppi: คำสั่งนี้อาจทำให้เครื่องจักรขยับหรือแย่ง bus ...`
- **VS Code** ไม่แสดงเหตุผล "gppi: ..." — ในการทดสอบ prompt ของตัวกันไม่มีปุ่ม "Yes, allow ... for this project" แต่ prompt ปกติบางแบบก็ไม่มีปุ่มนี้ จึงใช้แยกแบบแน่นอนไม่ได้
- **ตัวเลือกเริ่มต้นคือ "1. Yes"** — กด Enter ครั้งเดียว = อนุญาต
- **ถามได้ในทุก permission mode ที่ทดสอบ** — default, auto (ค่าเริ่มต้นของ CLI) และ `bypassPermissions`

## สิ่งที่ไม่จับ
> [!WARNING]
> - wrapper script: `./bringup.sh`, `make run`
> - โค้ดที่สั่งเครื่องจากข้างใน script ที่เป็นไฟล์: `python write_plc.py`, node ที่เขียน register เอง
> - `kill <pid>`, alias/function ของ shell, การเรียกผ่าน `$(which ros2)`, การแยกคำด้วย quote (`ros2 "launch"`)
> - MCP tool ที่ชื่อไม่บอกว่าเขียน (`execute_sql` เขียนได้แต่ไม่ถาม) — ป้องกันด้วยโหมดอ่านอย่างเดียวของ server + deny rule + สิทธิ์ฝั่งระบบ ([templates/mcp](../mcp/README.md))
> - `bash -c reboot` ที่ไม่มี quote, `doas -u x ...`, docker ที่มี global option ซึ่งไม่อยู่ในรายการ (`--tlscacert ca.pem run`), `nerdctl compose`
>
> กฎใน `rules.md` จึงยังใช้เต็มที่ และคนต้องอ่านคำสั่งก่อนกดยืนยันทุกครั้ง

## ทำงานอย่างไร (ข้างใน)
logic อยู่ที่ [`hooks/gppi.ts`](../hooks/gppi.ts) ไฟล์เดียว ถูกเรียกผ่านสองทาง:

1. **PreToolUse hook** — `node hooks/pretooluse.ts` (ตั้งใน [`hooks/hooks.json`](../hooks/hooks.json)) ตอบ `ask` — เป็นทางเดียวที่ docs ของ Claude Code รับประกันว่าบังคับถามคนได้แม้ใน auto mode ([ADR-0003](dev/adr/0003-guard-hook-plus-mod.md))
2. **mod** (`tool.check`) — สำรองไว้ตอน hook ไม่ได้ทำงาน; ถ้า hook ตอบ ask ไปแล้ว mod ไม่แตะ (Claude Code ไม่ยอมให้ plugin เขียนทับ ask ของ hook)

**hook รันไม่ได้ = บล็อกคำสั่ง shell ทั้งหมด** (fail-closed) — คำสั่งใน hooks.json ต่อท้ายด้วย `|| { echo ... >&2; exit 2; }` ถ้า node ไม่มี/เก่า/ไม่อยู่ใน PATH Claude จะได้ข้อความ "gppi: ตัวกันคำสั่ง ... รันไม่ได้" และรัน Bash/PowerShell ไม่ได้จนกว่าจะแก้ — ตั้งใจให้เห็นปัญหาตั้งแต่วันแรก ดีกว่าตัวกันพังเงียบๆ แล้วไปเจอตอนต่อเครื่องจริง

ข้อยกเว้นที่ยังปล่อยผ่าน (เหลือแค่ mod ซึ่ง **ไม่กันใน auto mode**):
- Windows ที่ **ไม่มี Git Bash** — hook รันด้วย PowerShell ซึ่งคำสั่งบล็อกแบบ bash ไม่ทำงาน (อ่านจาก syntax ยังไม่ได้ทดสอบ) → ติดตั้ง Git for Windows ทุกเครื่อง
- hook ทำงานเกิน timeout 30 วินาที (เช่น antivirus สแกน node ตอนเปิดครั้งแรก) — Claude Code นับเป็น error ที่ไม่บล็อก

เครื่องที่ยังใช้ gppi ไม่ได้: ใส่กฎ `ask` ของ git นี้ใน `.claude/settings.json` ของโปรเจกต์แทน (plugin ส่ง permission rule ให้ผู้ใช้ไม่ได้) — กันได้แค่ git ไม่ได้กันคำสั่งเครื่องจักร
```json
{
  "permissions": {
    "ask": [
      "Bash(git push *)",
      "Bash(git reset --hard *)",
      "Bash(git clean *)",
      "Bash(git branch -D *)",
      "Bash(git checkout -- *)",
      "Bash(git checkout . *)",
      "Bash(git restore *)",
      "Bash(git -C * push *)",
      "Bash(git -C * reset --hard *)",
      "Bash(git -C * clean *)",
      "Bash(git -C * branch -D *)",
      "Bash(git -C * restore *)",
      "PowerShell(git push *)",
      "PowerShell(git reset --hard *)",
      "PowerShell(git clean *)",
      "PowerShell(git branch -D *)",
      "PowerShell(git checkout -- *)",
      "PowerShell(git checkout . *)",
      "PowerShell(git restore *)",
      "PowerShell(git -C * push *)",
      "PowerShell(git -C * reset --hard *)",
      "PowerShell(git -C * clean *)",
      "PowerShell(git -C * branch -D *)",
      "PowerShell(git -C * restore *)"
    ]
  }
}
```

กฎใน `rules.md` ส่งเข้า session ผ่าน hook `SessionStart` (`cat rules.md`) เพราะ Claude Code ไม่ให้ plugin แก้ system prompt ตรงๆ — ทดสอบแล้วบน Windows ที่มี Git Bash และ WSL; เครื่องที่ไม่มี Git Bash รันด้วย PowerShell ซึ่ง `cat` เป็น alias ของ `Get-Content` (ยังไม่ได้ทดสอบ)

## แก้ตัวกัน
- เขียน test ของคำสั่งที่ต้องถาม/ไม่ต้องถามใน [`hooks/gppi.test.ts`](../hooks/gppi.test.ts) **ก่อน** แก้ regex (skill `tdd`) แล้วรัน `claude plugin test .`
- **regex ที่ช้า = ตัวกันปล่อยผ่าน** — hook ที่เกิน timeout ไม่บล็อก; เคยวัดได้ 17 วินาที (`ssh -pa` ซ้ำ 30 ตัว) และ 194 วินาที (deploy Node-RED พร้อม flow JSON ~400KB) — test เรื่องเวลาใน `gppi.test.ts` ต้องผ่านเสมอ
- ส่งให้ `gppi:safety-reviewer` ตรวจก่อน commit ทุกครั้ง
- ผลทดสอบจริงทุก surface/mode: [plugin-evaluation.md](dev/plugin-evaluation.md#ตัวกันคำสั่ง-gppi-010)
