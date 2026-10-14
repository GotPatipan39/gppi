import { test, expect } from 'claude-code/testing'
import { isRiskyGit, isMachineCommand, preToolUseDecision } from './gppi'

const RISKY = [
  'git push',
  'git push origin main',
  'git -C D:/ws/mskills push',
  'git -C "C:/Users/Got Automation/x" push origin main',
  'cd /d/ws/mskills && git push -u origin plugin-trial',
  'git reset --hard HEAD~1',
  'git clean -fd',
  'git branch -D old',
  'git branch --force -D old',
  'git checkout -- src/a.cpp',
  'git checkout .',
  'git restore src/a.cpp',
]
const SAFE = [
  'git status',
  'git log --oneline -5',
  'git diff --staged',
  'git commit -m "fix"',
  'git reset --soft HEAD~1',
  'git branch -d merged',
  'git checkout -b feature',
  'git checkout main',
  'echo push',
  'ls pushd',
]

test('จับคำสั่ง git อันตรายได้ครบ', () => {
  for (const c of RISKY) expect(isRiskyGit(c)).toBe(true)
})

test('ไม่ถามคำสั่ง git ที่ไม่อันตราย', () => {
  for (const c of SAFE) expect(isRiskyGit(c)).toBe(false)
})

// คำสั่งที่อาจทำให้เครื่องจักรขยับ — ถามทั้งหมด รวม sim (ตัดสินใจไว้: ไม่ยกเว้น sim)
const ROS2_MOVE = [
  'ros2 topic pub /cmd_vel geometry_msgs/msg/Twist "{linear: {x: 0.1}}"',
  'ros2 topic pub --once /servo_on std_msgs/msg/Bool "{data: true}"',
  'ros2 service call /plc/write my_msgs/srv/Write "{addr: 100}"',
  'ros2 action send_goal /move_base nav2_msgs/action/NavigateToPose "{}"',
  'ros2 launch robot_bringup bringup.launch.py',
  'ros2 run motor_driver driver_node',
  'ros2 param set /driver max_speed 2.0',
  'source install/setup.bash && ros2 launch robot_bringup sim.launch.py',
  'wsl -- bash -lc "source /opt/ros/humble/setup.bash && ros2 topic pub /cmd_vel geometry_msgs/msg/Twist {}"',
  '/opt/ros/humble/bin/ros2 launch robot_bringup bringup.launch.py',
  'wsl -- /opt/ros/humble/bin/ros2 run motor_driver driver_node',
  'ros2 lifecycle set /motor_driver activate',
  'ros2 control switch_controllers --activate diff_drive_controller',
  'ros2 control set_controller_state arm_controller active',
  'ros2 control load_controller --set-state active arm_controller',
  'ros2 bag play cmd_vel_recording',
  'ros2 param load /driver driver_params.yaml',
  'ros2 component load /ComponentManager motor_driver motor_driver::Driver',
]
const ROS2_READ = [
  'ros2 topic echo /odom',
  'ros2 topic list',
  'ros2 topic hz /scan',
  'ros2 node list',
  'ros2 param get /driver max_speed',
  'ros2 param list',
  'ros2 interface show std_msgs/msg/Bool',
  'ros2 lifecycle get /motor_driver',
  'ros2 control list_controllers',
  'ros2 bag info cmd_vel_recording',
  'ros2 bag record /odom',
  'colcon build --packages-select motor_driver',
  'ls ~/ros2_ws/src/my-ros2-launcher',
]

test('ROS2: ถามคำสั่งที่สั่ง driver/เปิด node', () => {
  for (const c of ROS2_MOVE) expect([c, isMachineCommand(c)]).toEqual([c, true])
})

test('ROS2: ไม่ถามคำสั่งอ่านอย่างเดียว', () => {
  for (const c of ROS2_READ) expect([c, isMachineCommand(c)]).toEqual([c, false])
})

const SERVICE_MOVE = [
  'sudo systemctl restart robot-bringup.service',
  'systemctl --user stop node-red',
  'sudo systemctl start palletizer',
  'sudo service node-red restart',
  'pm2 restart node-red',
  'pm2 start ecosystem.config.js',
  'pm2 stop all',
  '/usr/bin/systemctl restart robot-bringup',
  'sudo systemctl enable --now robot-bringup',
  'sudo systemctl disable --now robot-bringup',
  'sudo systemctl mask --now robot-bringup',
  'sudo systemctl isolate rescue.target',
  'systemctl -H robot@minipc restart robot-bringup',
  'pm2 startOrRestart ecosystem.config.js',
  'pm2 startOrReload ecosystem.config.js',
  'pm2 resurrect',
  'pm2-runtime start ecosystem.config.js',
  'pm2-runtime ecosystem.config.js',
  'sudo systemctl --now enable robot-bringup',
]
const SERVICE_READ = [
  'systemctl status robot-bringup',
  'journalctl -u robot-bringup -n 50',
  'systemctl list-units --type=service',
  'pm2 logs node-red --lines 50',
  'pm2 list',
  'pm2 status',
  'sudo systemctl enable robot-bringup',
  'systemctl is-active robot-bringup',
]

test('service: ถาม start/stop/restart ของ service ที่คุมเครื่อง', () => {
  for (const c of SERVICE_MOVE) expect([c, isMachineCommand(c)]).toEqual([c, true])
})

test('service: ไม่ถามการดูสถานะ/log', () => {
  for (const c of SERVICE_READ) expect([c, isMachineCommand(c)]).toEqual([c, false])
})

// เปิด bus = ถาม แม้แค่อ่าน เพราะชนกับ master ตัวเดิมบน RS-485
const BUS_OPEN = [
  'mbpoll -m rtu -a 1 -b 9600 -P none /dev/ttyUSB0 -r 100 -c 2',
  'mbpoll -a 1 -r 100 192.168.1.10 1234',
  'modpoll -m tcp -a 1 -r 100 192.168.1.10',
  'python3 -m pymodbus.console serial --port /dev/ttyUSB0',
  'minicom -D /dev/ttyUSB0 -b 115200',
  'picocom -b 9600 /dev/ttyACM0',
  'python -m serial.tools.miniterm /dev/ttyUSB0 9600',
  'screen /dev/ttyUSB0 115200',
  'stty -F /dev/ttyUSB0 9600 raw',
  'echo -ne "\\x01\\x03" > /dev/ttyUSB0',
  'cat /dev/ttyUSB0',
  '$p = New-Object System.IO.Ports.SerialPort COM3,9600; $p.Open()',
  '$p = New-Object IO.Ports.SerialPort COM3,9600; $p.Open()',
  './mbpoll -a 1 -r 100 /dev/ttyUSB0',
  '/usr/local/bin/mbpoll -a 1 -r 100 192.168.1.10',
  'cat /dev/motor_controller',
  'dd if=/dev/ttyUSB0 bs=1 count=16 | xxd',
  'printf "\\x01\\x06" | dd of=/dev/ttyUSB0',
  'socat - /dev/ttyUSB0,b9600,raw',
  'tio -b 115200 /dev/ttyUSB0',
  'tio /dev/rs485',
  'cu -l /dev/ttyUSB0 -s 9600',
  'microcom -s 9600 /dev/ttyS1',
  'hexdump -C /dev/ttyUSB0',
  'python3 read_meter.py --port /dev/ttyUSB0',
  'PORT=ttyUSB0; screen /dev/$PORT 9600',
  'screen /dev/${DEV} 9600',
  'cat /dev/tty-plc',
  'cat /dev/tty.rs485',
  'test-rs485 /dev/ttyUSB0',
  'stat-reader /dev/ttyUSB0',
  'file -s /dev/ttyUSB0',
  'ls > /dev/ttyUSB0',
  'ls $(cat /dev/ttyUSB0)',
]
const BUS_LIST = [
  'ls -l /dev/ttyUSB*',
  'ls /dev/serial/by-id',
  'dmesg | grep tty',
  'udevadm info /dev/ttyUSB0',
  'python3 -m serial.tools.list_ports',
  '[System.IO.Ports.SerialPort]::GetPortNames()',
  'cat skills/modbus/devices/me231.md',
  'ls -l /dev/motor_controller',
  'readlink -f /dev/motor_controller',
  'colcon build 2>/dev/null',
  'grep -r ttyUSB src/ > /dev/null',
  'echo "error" > /dev/stderr',
  'v4l2-ctl -d /dev/video0 --all',
  'df -h /dev/sda1',
  'cd ~/dev/ros2_ws && colcon build',
  'cat /home/got/dev/notes.md',
  'git clone https://gitlab.com/team/dev/robot.git',
  'ls /dev/ttyUSB* 2>/dev/null',
  '[ -e /dev/ttyUSB0 ] && echo present',
  'exec 3</dev/tty',
]

test('bus: ถามการเปิด Modbus/serial port', () => {
  for (const c of BUS_OPEN) expect([c, isMachineCommand(c)]).toEqual([c, true])
})

test('bus: ไม่ถามการดูรายชื่อ port', () => {
  for (const c of BUS_LIST) expect([c, isMachineCommand(c)]).toEqual([c, false])
})

const NODERED_DEPLOY = [
  'curl -X POST http://localhost:1880/flows -H "Content-Type: application/json" -d @flows.json',
  'curl -s --request POST http://192.168.1.20:1880/flows --data-binary @flows.json',
  'curl -XPOST localhost:1880/flow -d @flow.json',
  'curl -X PUT http://localhost:1880/flow/abc123 -d @flow.json',
  'wget --post-file=flows.json http://localhost:1880/flows',
  'Invoke-RestMethod -Method Post -Uri http://localhost:1880/flows -InFile flows.json',
  'irm http://localhost:1880/flows -Method POST -Body $body',
  'curl -H "Content-Type: application/json" -d @flows.json http://localhost:1880/flows',
  'curl --data-binary @flows.json http://localhost:1880/flows',
  'curl --json @flows.json http://localhost:1880/flows',
  'curl -T flow.json http://localhost:1880/flow/abc123',
  "Invoke-RestMethod -Method 'Post' -Uri http://localhost:1880/flows -InFile flows.json",
  'Invoke-RestMethod -Method:Post -Uri http://localhost:1880/flows -InFile flows.json',
  'curl -sX POST http://localhost:1880/flows -H "Content-Type: application/json"',
  'curl -sXPOST localhost:1880/flows',
  'curl -sSd @flows.json http://localhost:1880/flows',
  'wget --method=POST --body-file=flows.json http://localhost:1880/flows',
]
const NODERED_READ = [
  'curl http://localhost:1880/flows',
  'curl -s http://localhost:1880/flows | jq length',
  'Invoke-RestMethod http://localhost:1880/flows',
  'curl -X POST http://localhost:3000/api/login -d @login.json',
  'curl -f http://localhost:1880/flows',
  'cp -f flows.json ~/.node-red/flows.json',
  'Invoke-RestMethod -Method Get -Uri http://localhost:1880/flows',
]

test('Node-RED: ถามการ deploy flow', () => {
  for (const c of NODERED_DEPLOY) expect([c, isMachineCommand(c)]).toEqual([c, true])
})

test('Node-RED: ไม่ถามการอ่าน flow', () => {
  for (const c of NODERED_READ) expect([c, isMachineCommand(c)]).toEqual([c, false])
})

// PreToolUse hook — ทางเดียวที่ docs รับประกันว่าบังคับถามคนได้ใน auto mode (mod tool.check ถูก classifier อนุมัติแทน)
const hookInput = (tool_name: string, command: unknown) =>
  ({ hook_event_name: 'PreToolUse', tool_name, tool_input: { command } })

test('PreToolUse: คำสั่งเครื่องจักร → ask พร้อมเหตุผล', () => {
  for (const tool of ['Bash', 'PowerShell']) {
    const out = preToolUseDecision(hookInput(tool, 'wsl -- bash -lc "ros2 topic pub /test std_msgs/msg/String {}"')) as any
    expect(out.hookSpecificOutput.hookEventName).toBe('PreToolUse')
    expect(out.hookSpecificOutput.permissionDecision).toBe('ask')
    expect(out.hookSpecificOutput.permissionDecisionReason).toContain('เครื่องจักร')
  }
})

test('PreToolUse: git ที่ย้อนกลับยาก → ask', () => {
  const out = preToolUseDecision(hookInput('Bash', 'git push origin main')) as any
  expect(out.hookSpecificOutput.permissionDecision).toBe('ask')
  expect(out.hookSpecificOutput.permissionDecisionReason).toContain('git')
})

test('PreToolUse: คำสั่งอื่น/tool อื่น/input แปลก → ไม่ตัดสิน (ปล่อยให้ระบบ permission ปกติ)', () => {
  expect(preToolUseDecision(hookInput('Bash', 'ros2 topic echo /odom'))).toBeUndefined()
  expect(preToolUseDecision(hookInput('Read', 'ros2 topic pub /x'))).toBeUndefined()
  expect(preToolUseDecision(hookInput('Bash', 42))).toBeUndefined()
  expect(preToolUseDecision(null)).toBeUndefined()
})

test('Bash/PowerShell: git push → ask, git status → ตามเดิม', async ($, on) => {
  on('tool.check', () => ({ decision: 'allow' }))
  for (const tool of ['Bash', 'PowerShell']) {
    expect((await $.tool.check({ tool, input: { command: 'git push origin main' } })).decision).toBe('ask')
    expect((await $.tool.check({ tool, input: { command: 'git status' } })).decision).toBe('allow')
  }
})

test('Bash/PowerShell: คำสั่งเครื่องจักร → ask พร้อมเหตุผลว่าเครื่องอาจขยับ', async ($, on) => {
  on('tool.check', () => ({ decision: 'allow' }))
  for (const tool of ['Bash', 'PowerShell']) {
    const v = await $.tool.check({ tool, input: { command: 'ros2 topic pub /cmd_vel geometry_msgs/msg/Twist {}' } })
    expect(v.decision).toBe('ask')
    expect(v.reason).toContain('เครื่องจักร')
    expect((await $.tool.check({ tool, input: { command: 'ros2 topic echo /odom' } })).decision).toBe('allow')
  }
})

test('ไม่ผ่อน deny ของคำสั่งเครื่องจักร', async ($, on) => {
  on('tool.check', () => ({ decision: 'deny', reason: 'blocked' }))
  expect((await $.tool.check({ tool: 'Bash', input: { command: 'pm2 restart node-red' } })).decision).toBe('deny')
})

test('ไม่ผ่อน deny ที่ engine ตัดสินไว้', async ($, on) => {
  on('tool.check', () => ({ decision: 'deny', reason: 'blocked' }))
  expect((await $.tool.check({ tool: 'Bash', input: { command: 'git push' } })).decision).toBe('deny')
})
