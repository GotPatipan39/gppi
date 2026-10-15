import { test, expect } from 'claude-code/testing'
import { isRiskyGit, isMachineCommand, preToolUseDecision } from './gppi'

const RISKY = [
  'git push',
  'git push origin main',
  'git -C D:/ws/gppi push',
  'git -C "C:/Users/Got Automation/x" push origin main',
  'cd /d/ws/gppi && git push -u origin feature-x',
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

// ขยายขอบเขต (Q23): container ที่รัน driver, Node-RED runtime/inject, python -c ที่สั่ง bus, หยุด process/เครื่อง, แย่ง COM ฝั่ง Windows
const MORE_MOVE = [
  'docker compose up -d',
  'docker compose restart driver',
  'docker-compose up',
  'docker compose down',
  'docker run --device /dev/ttyUSB0 robot/driver',
  'docker restart node-red',
  'docker stop plc-bridge',
  'curl -X POST http://localhost:1880/inject/a1b2c3',
  'node-red',
  'npx node-red -u ~/.node-red',
  'node-red-restart',
  "wsl -- bash -lc 'node-red-start'",
  'python3 -c "from pymodbus.client import ModbusTcpClient; c=ModbusTcpClient(\'192.168.1.10\'); c.write_coil(0, True)"',
  'python -c "import minimalmodbus; i=minimalmodbus.Instrument(\'/dev/ttyUSB0\', 1)"',
  "python3 - <<'EOF'\nimport serial\ns = serial.Serial('COM3', 9600)\nEOF",
  'pkill -f driver_node',
  'killall node-red',
  'sudo reboot',
  'ssh robot@minipc sudo shutdown -h now',
  'sudo poweroff',
  'sudo systemctl reboot',
  'Restart-Computer -Force',
  'usbipd attach --wsl --busid 1-4',
  'usbipd detach --busid 1-4',
  'mode COM3 BAUD=9600 PARITY=n DATA=8',
  // รอบตรวจที่ 3
  'docker compose -f bringup.yml up -d',
  'docker compose -p robot --project-directory /opt/robot restart',
  'docker -H ssh://robot@minipc start driver',
  'podman run --device /dev/ttyUSB0 robot/driver',
  'docker rm -f driver',
  "python3 <<'EOF'\nfrom pymodbus.client import ModbusTcpClient\nEOF",
  'echo "import minimalmodbus" | python3',
  'py -3 -c "from pyModbusTCP.client import ModbusClient; ModbusClient(host=\'192.168.1.10\').write_single_coil(0, True)"',
  'python -c "from serial import Serial; Serial(\'COM3\', 9600)"',
  'wsl --shutdown',
  'wsl -t Ubuntu-22.04',
  'sudo -u nodered node-red',
  '/usr/bin/node-red',
  'nohup node-red > nr.log 2>&1',
  'shutdown /r /t 0',
  'sudo init 6',
  'taskkill /F /IM node.exe',
  'Stop-Process -Name node -Force',
  'Restart-Service NodeRED',
  // รอบตรวจที่ 4: prefix ที่รันคำสั่งต่อ
  'ssh -p 2222 robot@minipc sudo reboot',
  'ssh -i key.pem robot@minipc sudo shutdown -h now',
  'ssh -o StrictHostKeyChecking=no robot@minipc pkill -f driver',
  'wsl -- sudo reboot',
  'wsl -d Ubuntu-22.04 -- pkill -f driver_node',
  'wsl -e pkill -f driver_node',
  'cmd /c shutdown /r /t 0',
  'powershell -Command shutdown /r',
  'shutdown.exe /r /t 0',
  'C:\\Windows\\System32\\shutdown.exe /r /t 0',
  'for h in pc1 pc2; do ssh $h sudo reboot; done',
  'if true; then pkill -f driver_node; fi',
  'echo driver | xargs pkill -f',
  'setsid node-red',
  'timeout -s KILL 5 pkill -f driver_node',
  "Start-Process shutdown -ArgumentList '/r /t 0'",
  'sudo reboot; echo done',
  'pkill -f driver&& echo stopped',
  'node-red|tee nr.log',
  // รอบตรวจที่ 5: คำว่า exec/logs/build/config ที่ไม่ใช่คำสั่งย่อยของ docker
  'docker compose -f config/robot.yml up -d',
  'docker compose -f build.yml up',
  'docker run --name exec-test robot/driver',
  'docker run -v logs:/data robot/driver',
  'docker start logs-collector',
  'docker --context minipc run -d nodered/node-red',
  'docker.exe run -d nodered/node-red',
]

test('ไม่ช้าผิดปกติกับ option ซ้ำๆ (ช้าเกิน timeout = hook ปล่อยผ่าน)', () => {
  const inputs = [
    'ssh ' + '-pa '.repeat(30) + 'h echo x',
    'sudo ' + '-u '.repeat(40) + 'x',
    'timeout ' + '-s '.repeat(40) + 'x',
    'docker ' + '-H '.repeat(40) + 'ps',
    'docker compose ' + '-f '.repeat(40) + 'ps',
    'wsl ' + '-d '.repeat(40) + 'x',
    'docker compose ' + '--file=a.yml '.repeat(30) + 'ps',
    'docker ' + '--context=x '.repeat(30) + 'ps',
  ]
  for (const c of inputs) {
    const t = performance.now()
    isMachineCommand(c)
    expect([c.slice(0, 12), performance.now() - t < 200]).toEqual([c.slice(0, 12), true])
  }
})

test('deploy Node-RED ที่ส่ง flow JSON ขนาดใหญ่ในบรรทัด: ยังถาม และไม่ช้า', () => {
  const c = "curl -X POST http://localhost:1880/flows -d '" + '{"a":"b","c":"/x/y"},'.repeat(20000) + "'"
  const t = performance.now()
  const asked = isMachineCommand(c)
  expect([asked, performance.now() - t < 1000]).toEqual([true, true])
})

const MORE_READ = [
  'docker ps',
  'docker logs -f driver',
  'docker compose ps',
  'docker exec driver cat /etc/os-release',
  'docker build -t robot/driver .',
  'pm2 logs node-red --lines 20',
  'cd ~/.node-red && ls',
  'node-red-admin list',
  'pip install pymodbus',
  'grep -rn pymodbus src/',
  'python -c "print(1)"',
  'python3 test_scale.py',
  'ps aux | grep driver',
  'kill 12345',
  'usbipd list',
  'mode con',
  'curl http://localhost:1880/inject/a1b2c3',
  // รอบตรวจที่ 3: คำว่า shutdown/halt/reboot ที่ไม่ใช่ตัวคำสั่ง — ทีม robot ใช้คำพวกนี้บ่อย ถ้าถามทุกครั้งคนจะกดผ่านโดยไม่อ่าน
  'git commit -m "fix safe shutdown sequence"',
  'git commit -m "add halt on e-stop"',
  'grep -rn shutdown src/',
  'vim docs/shutdown.md',
  'git log --grep=reboot',
  'ros2 topic echo /halt',
  'npm install node-red-contrib-modbus',
  'python3 -m pytest tests/test_pymodbus_scale.py',
  'docker ps --filter status=running',
  'wsl -l -v',
  'Get-Service NodeRED',
  // รอบตรวจที่ 4: docker ที่ไม่เปิด/หยุด container
  'docker exec ctr npm run build',
  'docker exec node-red npm start',
  'docker build --target run .',
  'docker logs run-1',
  'docker compose exec driver npm start',
]

// ถามเกินโดยตั้งใจ: quote นับเป็นตำแหน่งคำสั่ง (ต้องจับ bash -lc "sudo reboot") จึงถาม grep ที่ใส่ quote ด้วย
const OVER_ASK_ON_PURPOSE = [
  'grep -rn "shutdown" src/',
  'git commit -m "halt motion on e-stop"',
  'bash -lc "sudo reboot"',
]

test('ถามเกินโดยตั้งใจ: คำว่า shutdown/halt/reboot ที่อยู่ต้น quote', () => {
  for (const c of OVER_ASK_ON_PURPOSE) expect([c, isMachineCommand(c)]).toEqual([c, true])
})

test('ขยาย: ถาม docker/Node-RED runtime/python -c bus/หยุด process/แย่ง COM', () => {
  for (const c of MORE_MOVE) expect([c, isMachineCommand(c)]).toEqual([c, true])
})

test('ขยาย: ไม่ถามคำสั่งดูข้อมูลในกลุ่มเดียวกัน', () => {
  for (const c of MORE_READ) expect([c, isMachineCommand(c)]).toEqual([c, false])
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

// hook ตอบ ask ไปแล้ว → mod ไม่เขียนทับ (Claude Code ไม่ยอมและขึ้นคำเตือน "gppi tried to reword a PreToolUse hook's ask")
test('ask ที่มีอยู่แล้ว (จาก hook) ส่งต่อตามเดิม ไม่เขียนทับเหตุผล', async ($, on) => {
  on('tool.check', () => ({ decision: 'ask', reason: 'from hook' }))
  const v = await $.tool.check({ tool: 'Bash', input: { command: 'ros2 topic pub /test std_msgs/msg/String {}' } })
  expect([v.decision, v.reason]).toEqual(['ask', 'from hook'])
})

test('ไม่ผ่อน deny ของคำสั่งเครื่องจักร', async ($, on) => {
  on('tool.check', () => ({ decision: 'deny', reason: 'blocked' }))
  expect((await $.tool.check({ tool: 'Bash', input: { command: 'pm2 restart node-red' } })).decision).toBe('deny')
})

test('ไม่ผ่อน deny ที่ engine ตัดสินไว้', async ($, on) => {
  on('tool.check', () => ({ decision: 'deny', reason: 'blocked' }))
  expect((await $.tool.check({ tool: 'Bash', input: { command: 'git push' } })).decision).toBe('deny')
})

// MCP: ตัวกันเดิมดูแค่ Bash/PowerShell — MCP tool ที่เขียนค่า/สั่งอุปกรณ์ต้องถามด้วย
// ตัดสินจากชื่อ tool (ส่วนหลัง `__` ตัวสุดท้าย) ไม่ใช่ชื่อ server — deny rule ที่ผูกชื่อ server พลาดได้เมื่อโปรเจกต์ตั้งชื่ออื่น
const MCP_ASK = [
  'mcp__ros2__ros2_topic_publish',
  'mcp__ros2__ros2_publish_multiple_topics',
  'mcp__ros2__ros2_service_call',
  'mcp__ros2__ros2_send_action_goal',
  'mcp__ros2__ros2_cancel_action_goal',
  'mcp__modbus_line1__write_register',
  'mcp__modbus__write_registers',
  'mcp__modbus__write_coil',
  'mcp__modbus__write_point',
  'mcp__modbus__apply_safe_state',
  'mcp__plugin_acme_modbus__write_coil',
  'mcp__gitlab__merge_merge_request',
  'mcp__gitlab__create_pipeline',
  'mcp__gitlab__push_files',
  'mcp__gitlab__retry_pipeline_job',
  'mcp__nodered__nr_safe_deploy',
  'mcp__nodered__nr_inject',
  'mcp__nodered__start_flow',
  'mcp__snap7__plc_stop',
  'mcp__robot__set_parameter',
  'mcp__serial__serial_write',
  'mcp__grafana__update_dashboard',
]
const MCP_SAFE = [
  'mcp__ros2__ros2_topic_subscribe',
  'mcp__ros2__ros2_topic_list',
  'mcp__ros2__ros2_action_request_result',
  'mcp__modbus__read_registers',
  'mcp__modbus__read_points',
  'mcp__modbus__list_points',
  'mcp__modbus__get_command_log',
  'mcp__gitlab__get_merge_request',
  'mcp__gitlab__list_pipelines',
  'mcp__grafana__search_dashboards',
  'mcp__grafana__query_prometheus',
  'mcp__postgres__execute_sql',
  'mcp__context7__query-docs',
  'mcp__context7__resolve-library-id',
]
const mcpInput = (tool_name: string) => ({ tool_name, tool_input: { anything: 1 } })

test('MCP: tool ที่เขียน/สั่งอุปกรณ์ → ask ไม่ว่า server จะชื่ออะไร', () => {
  for (const t of MCP_ASK) {
    const out = preToolUseDecision(mcpInput(t)) as any
    expect({ t, d: out?.hookSpecificOutput?.permissionDecision }).toEqual({ t, d: 'ask' })
    expect(out.hookSpecificOutput.permissionDecisionReason).toContain('MCP')
  }
})

test('MCP: tool อ่านอย่างเดียว → ไม่ตัดสิน', () => {
  for (const t of MCP_SAFE) expect({ t, out: preToolUseDecision(mcpInput(t)) }).toEqual({ t, out: undefined })
})

test('MCP: ชื่อแปลก/ไม่ใช่ MCP → ไม่ตัดสิน และไม่ช้า', () => {
  expect(preToolUseDecision(mcpInput('mcp__x'))).toBeUndefined()
  expect(preToolUseDecision(mcpInput('Write'))).toBeUndefined()
  const t0 = performance.now()
  preToolUseDecision(mcpInput('mcp__s__' + 'a_'.repeat(20000) + 'x'))
  expect(performance.now() - t0 < 200).toBe(true)
})
