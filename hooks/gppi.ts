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
// ไม่จับ: script ในไฟล์ที่สั่งเครื่องจากข้างใน (python write_plc.py, node) — ส่วนนั้นพึ่ง rules.md และ safety-reviewer
// ยอมให้มี path นำหน้า (/opt/ros/humble/bin/ros2, ./mbpoll) แต่ไม่จับชื่อที่เป็นส่วนของคำอื่น (my-ros2-launcher)
const CMD = String.raw`(?<![\w.-])`
// ต้องอยู่ "ตำแหน่งคำสั่ง" — สำหรับคำที่เป็นภาษาธรรมดาด้วย (shutdown, halt, node-red) ไม่ให้ถามตอนอยู่ใน commit message, grep, path
// ตำแหน่งคำสั่ง = ต้นบรรทัด/หลัง ; & | ( หรือ quote (bash -lc '...') ตามด้วย prefix ที่รันคำสั่งต่อ แล้ว path
// prefix: sudo/doas, ตัวรันต่อ (nohup, setsid, xargs ...), ssh host (ข้ามค่าของ -p/-i/-o), wsl [--|-e], cmd /c, powershell -Command, keyword ของ shell, VAR=x
// option ที่มีค่า: ค่าต้องไม่ขึ้นต้นด้วย - (VAL) — ถ้าทับกับ `\s+-\S+` ได้ทั้งสองทาง regex จะ backtrack แบบ exponential
// (วัดได้ 17 วินาทีกับ `ssh -pa` 30 ตัว) แล้ว hook เกิน timeout = ปล่อยผ่าน
const VAL = String.raw`\s+[^-\s]\S*`
const PREFIX = [
  String.raw`sudo(?:\s+-u` + VAL + String.raw`|\s+-\S+)*`,
  String.raw`doas`,
  String.raw`(?:nohup|exec|time|env|setsid|stdbuf|nice|xargs|watch)(?:\s+-\S+)*`,
  String.raw`timeout(?:\s+-[sk]` + VAL + String.raw`|\s+-\S+)*\s+\S+`,
  String.raw`ssh(?:\s+-[bcDEeFIiJLlmOoPpQRSWw]` + VAL + String.raw`|\s+-\S+)*\s+\S+`,
  String.raw`wsl(?:\.exe)?(?:\s+-[du]` + VAL + String.raw`|\s+--(?:distribution|user|cd)` + VAL + String.raw`|\s+-(?:-|e|-exec)(?=\s))*`,
  String.raw`cmd(?:\.exe)?\s+/[ckCK]`,
  String.raw`(?:powershell|pwsh)(?:\.exe)?(?:\s+-(?![cC]\b|[cC]ommand\b)\S+)*\s+-[cC](?:ommand)?`,
  String.raw`npx(?:\s+-\S+)*`,
  String.raw`then|do|else|elif|\{|!`,
  String.raw`\w+=[^\s'"]*`,
].join('|')
// path หน้าชื่อคำสั่งหยุดที่ quote — ถ้าใช้ `\S*` ทุก quote จะวิ่งไปถึงท้าย token = O(n²)
// (วัดได้ 194 วินาทีกับ curl ที่ส่ง flow JSON ~400KB → เกิน timeout → ปล่อยผ่าน deploy จริง)
const AT_CMD = String.raw`(?:^|[;&|\n(]|['"])\s*(?:(?:` + PREFIX + String.raw`)\s+)*(?:[^\s/\\'"]*[/\\])*`
// global option ของ docker และ option ของ compose ที่มีค่า (-H host, --context x, -f file, -p name) — ข้ามไปถึงคำสั่งย่อย
// รูป --opt=val ให้ `\s+-\S+` จับ — ถ้ามี `=\S+` อีกทาง token เดียว parse ได้สองแบบ = exponential
const DOCKER_OPTS = String.raw`(?:\.exe)?(?:\s+(?:-H|--host|-c|--context|--config|-l|--log-level)` + VAL + String.raw`|\s+-\S+)*`
const COMPOSE_OPTS = String.raw`(?:\.exe)?(?:\s+(?:-f|--file|-p|--project-name|--project-directory|--env-file|--profile|--ansi|--progress|--parallel)` + VAL + String.raw`|\s+-\S+)*`
// ชื่อคำสั่งจบแล้ว (รวม .exe บน Windows)
const CMD_END = String.raw`(?:\.exe)?(?=[\s;&|'")\x60]|$)`
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
  // container ที่อาจรัน driver/Node-RED — ดูที่ "คำสั่งย่อย" หลังข้าม global option เท่านั้น
  // (exec/logs/build ไม่ถาม: run/start ข้างหลังเป็นของคำสั่งใน container เช่น npm start; ros2 ข้างในถูก regex ของ ros2 จับอยู่แล้ว)
  new RegExp(CMD + String.raw`(?:docker|podman)` + DOCKER_OPTS + String.raw`\s+compose` + COMPOSE_OPTS + String.raw`\s+(?:up|start|restart|stop|down|kill|run|pause|unpause|rm)\b`),
  new RegExp(CMD + String.raw`(?:docker|podman)-compose` + COMPOSE_OPTS + String.raw`\s+(?:up|start|restart|stop|down|kill|run|pause|unpause|rm)\b`),
  new RegExp(CMD + String.raw`(?:docker|podman|nerdctl)` + DOCKER_OPTS + String.raw`\s+(?:container\s+)?(?:run|start|restart|stop|kill|pause|unpause)\b`),
  new RegExp(CMD + String.raw`(?:docker|podman|nerdctl)` + DOCKER_OPTS + String.raw`\s+(?:container\s+)?rm\b[^;&|\n]*?\s-\w*f`),
  // เปิด Node-RED runtime = flow ที่ต่อ PLC เริ่มทำงาน (ไม่ใช่ `pm2 logs node-red`, node-red-admin, node-red-contrib-*)
  new RegExp(AT_CMD + String.raw`node-red(?:-start|-restart|-stop)?` + CMD_END),
  // หยุด driver กลางคำสั่ง / ปิดเครื่อง — ถ้าไม่มี watchdog เครื่องค้างค่าสุดท้าย; `kill <pid>` ไม่รวม (Claude ใช้หยุด process ที่ตัวเองเปิด)
  new RegExp(AT_CMD + String.raw`(?:pkill|killall|reboot|shutdown|poweroff|halt)` + CMD_END),
  new RegExp(AT_CMD + String.raw`(?:tel)?init\s+[06]\b`),
  /\bStart-Process\b[^;|\n]*?\b(?:shutdown|reboot|node-red|taskkill|pkill)\b/i,
  new RegExp(CMD + String.raw`systemctl\s+(?:-\S+\s+)*(?:reboot|poweroff|halt|kexec)\b`),
  new RegExp(CMD + String.raw`wsl(?:\.exe)?\s+(?:-\S+\s+)*?(?:--shutdown|--terminate|-t)\b`, 'i'),
  // ฝั่ง Windows: หยุด process/service ที่อาจเป็น Node-RED/KEPServer/driver, ปิดเครื่อง
  /\b(?:Restart|Stop)-Computer\b|\b(?:Stop|Restart|Start)-Service\b|\bStop-Process\b|\btaskkill\b/i,
  new RegExp(AT_CMD + String.raw`(?:sc(?:\.exe)?|nssm(?:\.exe)?)\s+(?:stop|start|restart)\b`, 'i'),
  // แย่ง COM port ฝั่ง Windows (ดึง USB-RS485 ไป WSL / ตั้งค่า port ที่ HMI/SCADA ใช้อยู่)
  new RegExp(CMD + String.raw`usbipd(?:\.exe)?\s+(?:wsl\s+)?(?:attach|detach)\b`, 'i'),
  new RegExp(CMD + String.raw`mode\s+COM\d+`, 'i'),
]

// python ที่มีโค้ดสั่ง bus อยู่ในบรรทัดคำสั่งเอง (-c, heredoc, pipe) — script ในไฟล์ไม่จับ (ชื่อไฟล์ไม่มีคำเหล่านี้แบบเต็มคำ)
const PYTHON_CMD = /(?<![\w.-])(?:python[\d.]*|py)(?:\.exe)?(?=\s|$|['")])/
const BUS_CODE = /\b(?:pymodbus|minimalmodbus|pyModbusTCP|Modbus(?:Tcp|Serial|Udp)?Client|write_(?:(?:single|multiple)_)?(?:registers?|coils?))\b|\b(?:serial\.)?Serial\(/
const pythonDrivesBus = (command: string): boolean => PYTHON_CMD.test(command) && BUS_CODE.test(command)

// deploy Node-RED = ส่ง flow ไปที่ /flow(s) ด้วย POST/PUT; GET อ่าน flow ไม่ถาม
// curl เปลี่ยนเป็น POST/PUT เองเมื่อมี -d/-F/-T (รวมแบบติดกับ flag อื่น: -sSd) — case-sensitive เพราะ -f ของ curl ไม่ส่งข้อมูล
const NODERED_FLOWS = /\/(?:flows?|inject)\b/
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
  MACHINE.some(r => r.test(command)) || deploysNodeRed(command) || opensBusDevice(command) || pythonDrivesBus(command)

const GUARDED_TOOLS = ['Bash', 'PowerShell']

// เหตุผลที่ต้องถาม หรือ undefined ถ้าไม่ต้องถาม — ใช้ทั้ง mod และ PreToolUse hook
export const askReason = (command: string): string | undefined =>
  isMachineCommand(command) ? 'gppi: คำสั่งนี้อาจทำให้เครื่องจักรขยับหรือแย่ง bus ต้องให้ผู้ใช้ยืนยัน'
  : isRiskyGit(command) ? 'gppi: คำสั่ง git ที่ย้อนกลับยาก ต้องให้ผู้ใช้ยืนยัน'
  : undefined

// คำตอบของ PreToolUse hook (hooks/pretooluse.ts) — hook `ask` บังคับถามคนแม้ใน auto mode ซึ่ง mod `tool.check` ทำไม่ได้
// undefined = ไม่ตัดสิน ปล่อยให้ระบบ permission ปกติ (ไม่ตอบ allow เด็ดขาด เพราะจะข้าม prompt)
export const preToolUseDecision = (input: unknown): object | undefined => {
  const { tool_name, tool_input } = (input ?? {}) as { tool_name?: unknown; tool_input?: { command?: unknown } }
  const command = tool_input?.command
  if (typeof tool_name !== 'string' || !GUARDED_TOOLS.includes(tool_name) || typeof command !== 'string') return undefined
  const reason = askReason(command)
  return reason && {
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: reason },
  }
}

export const register: Register = on => {
  // literal แทน GUARDED_TOOLS เพื่อให้ `claude plugin validate` อ่าน filter ออก — แก้ต้องแก้ทั้งสองที่ (และ matcher ใน hooks.json)
  for (const tool of ['Bash', 'PowerShell']) {
    on('tool.check', { tool }, async ($, e, next) => {
      const verdict = await next(e)
      if (verdict.decision === 'deny') return verdict
      const command = (e.input as { command?: unknown }).command
      if (typeof command !== 'string') return verdict
      const reason = askReason(command)
      return reason ? { decision: 'ask', reason } : verdict
    }).catch(() => ({ decision: 'ask', reason: 'gppi: ตัวตรวจคำสั่งทำงานผิดพลาด จึงขอให้ผู้ใช้ยืนยันแทน' }))
  }
}
