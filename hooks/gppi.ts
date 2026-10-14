import type { Register } from 'claude-code'

// คำสั่ง git ที่ย้อนกลับยาก — ให้ผู้ใช้ยืนยันก่อน (แทนกฎ ask ใน settings.json ที่ plugin ส่งไม่ได้)
// จับทั้ง `git push` และ `git -C <path> push`; เจอคำว่า push ในข้อความอื่นที่ขึ้นต้นด้วย git แล้วถามเกิน ยังปลอดภัยกว่าหลุด
// กฎ (rules.md) ส่งผ่าน SessionStart ใน hooks.json แทน prompt.compose — Claude Code 2.1.296 ไม่ให้ plugin ของผู้ใช้แก้ system prompt
const GIT = String.raw`(?:^|[;&|\n(]\s*)git\b[^;&|\n]*?\s`
const RISKY_GIT: readonly RegExp[] = [
  new RegExp(GIT + String.raw`push\b`),
  new RegExp(GIT + String.raw`reset\s+--hard\b`),
  new RegExp(GIT + String.raw`clean\b`),
  new RegExp(GIT + String.raw`branch\s+(?:\S+\s+)*-D\b`),
  new RegExp(GIT + String.raw`checkout\s+(?:--|\.)(?:\s|$)`),
  new RegExp(GIT + String.raw`restore\b`),
]

export const isRiskyGit = (command: string): boolean => RISKY_GIT.some(r => r.test(command))

// คำสั่งที่อาจทำให้เครื่องจักรขยับ — ให้ผู้ใช้ยืนยันก่อน ไม่ยกเว้นงาน sim (แยกจากคำสั่งไม่ได้ว่าต่อ driver จริงไหม)
// จับทุกตำแหน่งในบรรทัด ไม่ใช่แค่ต้นคำสั่ง เพราะจาก Windows มักรันผ่าน `wsl -- bash -lc "... ros2 launch ..."`
// ไม่จับ: script ที่สั่งเครื่องจากข้างใน (python pymodbus, node) — ส่วนนั้นพึ่ง rules.md และ safety-reviewer
// ยอมให้มี path นำหน้า (/opt/ros/humble/bin/ros2, ./mbpoll) แต่ไม่จับชื่อที่เป็นส่วนของคำอื่น (my-ros2-launcher)
const CMD = String.raw`(?<![\w.-])`
const MACHINE: readonly RegExp[] = [
  new RegExp(CMD + String.raw`ros2\s+(?:topic\s+pub|service\s+call|action\s+send_goal|launch|run|param\s+(?:set|load)|lifecycle\s+set|control\s+(?:switch_controllers|set_controller_state|load_controller)|bag\s+play|component\s+load)\b`),
  // service ที่คุมเครื่อง: reload/kill/isolate ถามด้วย เพราะมีผลเท่ากับ restart/stop; ข้าม option ที่มีค่า (-H host) ด้วยการหาคำสั่งในส่วนเดียวกัน
  new RegExp(CMD + String.raw`systemctl\b[^;&|\n]*?\s(?:start|stop|restart|try-restart|reload|reload-or-restart|try-reload-or-restart|kill|isolate)\b`),
  new RegExp(CMD + String.raw`systemctl\b(?=[^;&|\n]*\s--now\b)[^;&|\n]*?\s(?:enable|disable|mask)\b`),
  new RegExp(CMD + String.raw`service\s+\S+\s+(?:start|stop|restart|reload)\b`),
  new RegExp(CMD + String.raw`pm2\s+(?:-\S+\s+)*(?:start\w*|stop|restart|reload|delete|kill|resurrect|scale)\b`),
  new RegExp(CMD + String.raw`pm2-runtime\b`),
  // เปิด Modbus/serial bus — ถามแม้แค่อ่าน เพราะชนกับ master ตัวเดิมบน RS-485
  new RegExp(CMD + String.raw`(?:mbpoll|modpoll|minicom|picocom|microcom|tio|putty|plink)\b`),
  new RegExp(CMD + String.raw`cu\s+-l\b`),
  new RegExp(String.raw`(?:pymodbus\.console|serial\.tools\.miniterm)\b`),
  new RegExp(String.raw`(?:System\.)?IO\.Ports\.SerialPort(?!\]::GetPortNames)`),
]

// deploy Node-RED = ส่ง flow ไปที่ /flow(s) ด้วย POST/PUT; GET อ่าน flow ไม่ถาม
// curl เปลี่ยนเป็น POST/PUT เองเมื่อมี -d/-F/-T (รวมแบบติดกับ flag อื่น: -sSd) — case-sensitive เพราะ -f ของ curl ไม่ส่งข้อมูล
const NODERED_FLOWS = /\/flows?\b/
const WRITE_METHOD = /(?:-\w*X\s*['"]?|--request[=\s]+|--method=|-Method[:\s]+['"]?)(?:POST|PUT)\b/i
const SENDS_BODY = /(?<=\s)(?:-[a-zA-Z]{0,4}[dFT](?=[\s@'"=]|$)|--data|--json\b|--form\b|--upload-file\b|--post-)/
const deploysNodeRed = (command: string): boolean =>
  NODERED_FLOWS.test(command) && (WRITE_METHOD.test(command) || SENDS_BODY.test(command))

// device ที่ไม่ใช่ serial/bus — แตะได้ไม่ต้องถาม (2>/dev/null, กล้อง, disk, terminal ของตัวเอง /dev/tty)
// tty ต้องจบคำจริงๆ: /dev/tty-plc, /dev/tty.rs485 เป็น symlink ของ bus ได้
const NON_BUS_DEV = String.raw`(?:null|zero|u?random|full|std(?:in|out|err)|fd/|tty(?=[\s'")]|$)|pts/|ptmx|shm/|video|v4l|media|dri/|snd/|input/|sd[a-z]|nvme|mmcblk|loop|disk/|mapper/|kvm|fuse|net/tun|bus/usb)`
// /dev/ ต้องเป็นต้น path (ไม่ใช่ ~/dev/ หรือ gitlab.com/team/dev/) และรวมชื่อจากตัวแปร (/dev/$PORT)
const DEV_PATH = new RegExp(String.raw`(?<![\w.~-])/dev/(?!` + NON_BUS_DEV + String.raw`)[^\s'"]`)
// คำสั่งที่แค่ดูข้อมูลของ device โดยไม่เปิด port — ต้องเป็นคำสั่งนั้นทั้งคำ (ไม่ใช่ test-rs485)
const DEV_INSPECT = /^(?:sudo\s+)?(?:ls|udevadm|dmesg|stat|readlink|realpath|test|\[)(?=\s|$)/
// แต่ถ้าใน segment เดียวกันมี redirect ไปที่ bus หรือ command substitution ก็เปิด port ได้
const OPENS_INSIDE = new RegExp(String.raw`[<>]\s*/dev/(?!` + NON_BUS_DEV + String.raw`)|\$\(|` + '`')

// แตะ device path ที่อาจเป็น serial/RS-485 (รวม symlink ของ udev อย่าง /dev/motor_controller) ในส่วนคำสั่งที่ไม่ใช่การดูข้อมูล
const opensBusDevice = (command: string): boolean =>
  command.split(/[;&|\n]+/).some(part => {
    const p = part.trim()
    return DEV_PATH.test(p) && (!DEV_INSPECT.test(p) || OPENS_INSIDE.test(p))
  })

export const isMachineCommand = (command: string): boolean =>
  MACHINE.some(r => r.test(command)) || deploysNodeRed(command) || opensBusDevice(command)

export const register: Register = on => {
  for (const tool of ['Bash', 'PowerShell']) {
    on('tool.check', { tool }, async ($, e, next) => {
      const verdict = await next(e)
      if (verdict.decision === 'deny') return verdict
      const command = (e.input as { command?: unknown }).command
      if (typeof command !== 'string') return verdict
      if (isMachineCommand(command))
        return { decision: 'ask', reason: 'gppi: คำสั่งนี้อาจทำให้เครื่องจักรขยับหรือแย่ง bus ต้องให้ผู้ใช้ยืนยัน' }
      if (isRiskyGit(command))
        return { decision: 'ask', reason: 'gppi: คำสั่ง git ที่ย้อนกลับยาก ต้องให้ผู้ใช้ยืนยัน' }
      return verdict
    }).catch(() => ({ decision: 'ask', reason: 'gppi: ตัวตรวจคำสั่งทำงานผิดพลาด จึงขอให้ผู้ใช้ยืนยันแทน' }))
  }
}
