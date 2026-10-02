<!--
  ตัวอย่างต้นแบบ — README ของโปรเจกต์ borunte-control ที่ผู้ใช้เขียนเอง (เก็บไว้ตามต้นฉบับ)
  ใช้ดูระดับรายละเอียด น้ำเสียง และวิธีอธิบาย "ทำไม" — ห้ามคัดลอกเนื้อหา/ค่า (IP, URL, ชื่อ node) ไปใช้กับโปรเจกต์อื่น
-->
# Borunte Control

Web-based control system for [Borunte](https://www.borunte.com/) industrial robot arms, built on **ROS 2 Humble**. It pairs a real-time operator UI (Next.js) with a four-node ROS 2 backend that talks to the robot over its native TCP/JSON protocol, so teaching, programming and running a job all happen from the browser.

> [!IMPORTANT]
> **The teach pendant is still part of the system.** Motion is commanded by writing a target to a general register block, which a program running on the pendant reads in a loop and executes — so that program must be loaded and running for anything here to move the arm. The pendant also remains the recovery path: clearing an alarm the controller refuses to clear remotely, and stopping the robot when a stop could not be confirmed, are both done there. The browser replaces the pendant for day-to-day operation, not for commissioning or recovery.

## Features

- **Live robot dashboard** — position (XYZUVW), joint angles, alarms, and 32-channel digital I/O streamed to the browser at 10 Hz
- **Manual control** — hold-to-jog on all 6 axes, direct output switching, alarm reset
- **Two-level speed** — each move step carries a percentage, and a master speed on the Operator page scales every one of them (`step × master ÷ 100`), adjustable mid-run to slow a program down while watching it
- **Point teaching** — snapshot the robot's current pose as a named point, re-teach an existing point in place, and organise the list into named groups in whatever order suits the job
- **Sequence programming** — visual editor with move, I/O, wait, conditional jump, counter, message, sub-sequence, and pallet steps, colour-coded by category; run once, loop, or single-step with pause/resume
- **Palletizing** — define a grid from 3 reference points and let the system interpolate every cell position; add a 4th point for multi-layer 3D pallets (tilted pallets supported)
- **Projects** — points, sequences, pallets, and settings are grouped into switchable workspaces stored as plain JSON files
- **Variables and arithmetic** — one kind of named number for counts, computed results and device readings; `+ − × ÷` with either operand a literal or another variable
- **Modbus RTU/TCP** — read and write values on PLCs, inverters and sensors from a sequence: wait for a temperature, branch on a status word, send a computed setpoint
- **Safe renaming** — renaming a point or a sub-sequence rewrites every step and pallet corner that refers to it, in the same save, so a reference can never be left pointing at something that no longer exists
- **Standard ROS 2 interfaces** — everything the UI can do is also available as ROS 2 topics, services, and actions for integration with other nodes

## Safety: how Stop behaves

> [!WARNING]
> This system commands real robot motion. Verify the robot's surroundings are clear and keep the physical e-stop within reach before running moves or sequences from the UI.

The rest is worth knowing before operating this, because it is not obvious from the button:

- **Stop is two presses, not one.** The controller treats a single `stopButton` the way the pendant does — the arm finishes the point it is working on and only then stops. Measured mid-move: one press ran the full 140 mm to target, two presses stopped it 140 mm short. The driver always sends both, 200 ms apart.
- **Stop interrupts a move in progress.** A sequence waiting on a move used to sit out the full arrival timeout before noticing; it now aborts the wait directly, so the arm halts in around 0.1 s rather than up to 30 s.
- **If a stop is not confirmed, Run is refused.** When the driver cannot confirm the robot came to rest, the sequence engine records it and rejects the next run goal, and the UI says to stop the robot at the pendant. This is deliberate — the alternative is starting a program while the arm may still be moving.
- **`actionStop` is not used.** It drops the servos, and this protocol offers no servo-on command to bring them back, so recovery would need a trip to the pendant.

## Architecture

```
                 Browser (Next.js UI, port 8080)
                          │  roslibjs
                          ▼
              rosbridge_websocket (port 9090)
                          │  DDS
    ┌───────────────┬─────────┴────────┬──────────────────┐
    ▼               ▼                  ▼                  ▼
robot_driver_node  sequence_engine_node  data_node   modbus_node
 /robot/state 10Hz  RunSequence action    CRUD srvs   read/write
 move/jog/io srvs   pause/resume/step     pallet math  register
    │                                        │            │
    ▼ TCP/JSON (9760)                        ▼            ▼ TCP 502 / RS-485
 Borunte robot                    data/projects/*.json   PLCs, sensors
```

| Package | Purpose |
|---|---|
| `borunte_msgs` | All `.msg` / `.srv` / `.action` interface definitions |
| `borunte_control` | The four rclpy nodes plus the Borunte TCP/JSON SDK |
| `borunte_bringup` | Launch file and parameters for the whole stack, UI included |

- **`robot_driver_node`** owns the single TCP connection to the robot, publishes `/robot/state`, and exposes `move_to`, `jog`, `set_output`, `set_speed`, `stop`, `connect`, `clear_alarm`, and `rcc_move` services. It reconnects automatically if the robot drops, and applies the project's master speed to every move and jog it issues.
- **`sequence_engine_node`** hosts the `RunSequence` action server (goal → per-step feedback → result/cancel) and interprets sequence programs, reading robot I/O from a cached `/robot/state` subscription.
- **`data_node`** serializes all JSON file access behind ROS 2 services, so concurrent writes can never corrupt a project. The active project survives restarts.
- **`modbus_node`** owns every Modbus connection, TCP and RTU alike, and exposes `read_register` / `write_register`. It does not poll: the bus carries traffic only when a step or a Test read asks for a value, so an RS-485 segment stays free the rest of the time and a dead device costs one timeout at the moment it is used rather than continuously.

### How motion is actually commanded

Every move writes a target pose into register block 800–805 and lets the pendant program — an endless loop watching that block — carry it out. This one mechanism explains several things that would otherwise look odd:

- **Jog is incremental, not continuous.** The protocol has no "move this axis until I say stop" command; the 19 documented control commands are all either point-to-point or speed/config changes. Holding a jog button therefore issues a small absolute move every 200 ms and sends a stop on release. It behaves like continuous jog and is not one.
- **Joint-frame jog is unsupported.** Register 800 is a *general-purpose* block whose six values this pendant program happens to interpret as cartesian. Nothing documents where joint targets would go, so the driver refuses them rather than guessing.
- **Start is sent with every move.** The controller reports "Auto-running" in states where the loop is nevertheless not watching the register — notably just after a stop — and a target written in that state would simply never be consumed.

## Prerequisites

- Ubuntu 22.04 with [ROS 2 Humble](https://docs.ros.org/en/humble/Installation.html) (`ros-humble-desktop`)
- `ros-humble-rosbridge-suite`
- Node.js 18+ (for the UI)
- `pymodbus==3.15.0` — pinned, and vendored as a wheel under [`vendor/`](vendor/) so a machine with no internet can install it with `pip install --no-index --find-links vendor pymodbus==3.15.0`. Pinned rather than floated because 3.15 changed its API from earlier 3.x releases; the `python3-pymodbus` in apt is 2.1.0 and a different API again
- A Borunte robot reachable over TCP (this deployment: `192.168.200.123:9760`, set in the config file below)

## Getting started

```bash
git clone http://gitlab.kimpai.dev/N.Patipan/borunte-control.git
cd borunte-control

# 1. Build the ROS 2 workspace
source /opt/ros/humble/setup.bash
cd ros2_ws
colcon build --symlink-install
source install/setup.bash
cd ..

# 2. Build the UI
cd ui
npm install
npm run build
cd ..

# 3. Launch everything (nodes + rosbridge + UI)
ros2 launch borunte_bringup borunte_bringup.launch.py
```

Then open `http://<machine-ip>:8080` in a browser. Read [Safety: how Stop behaves](#safety-how-stop-behaves) before commanding any motion.

### Running under PM2 (production)

The repository ships a PM2 config that supervises the whole stack as one app:

```bash
pm2 start ecosystem.config.js   # app name: "borunte"
pm2 save

pm2 logs borunte                # combined logs from every node
pm2 restart borunte             # restart after config changes
```

## Configuration

System-wide settings live in [`ros2_ws/src/borunte_bringup/config/borunte_control.yaml`](ros2_ws/src/borunte_bringup/config/borunte_control.yaml). Restart the stack after editing.

| Parameter | Node | Value in config | Description |
|---|---|---|---|
| `robot_ip` / `robot_port` | robot_driver | `192.168.200.123:9760` | Robot controller address |
| `poll_rate_hz` | robot_driver | `10.0` | Robot status poll/publish rate |
| `arrival_tolerance` | robot_driver | `0.05` | Fallback position tolerance (mm) — see note |
| `move_call_timeout` | robot_driver | `45.0` | Ceiling for one `move_to` call (s), above the SDK's 30 s arrival timeout |
| `step_delay` | sequence_engine | `0.1` | Pause between sequence steps (s) |
| `data_dir` | data_node | `data/projects` | Project storage root |

> [!NOTE]
> **Where a setting actually comes from.** Arrival tolerance and master speed are read from the *active project's* `settings.json` on every move, so they can be changed from the UI without restarting anything. The values above apply only as a fallback, when data_node is unreachable or the stored value is out of range. Tolerance is edited on the **Settings** page, master speed on the **Operator** page — it belongs with the run controls because it is set per run, by whoever is watching the machine. Robot IP/Port is intentionally *not* per-project.

The UI reads one optional env var, `NEXT_PUBLIC_ROSBRIDGE_URL` (see [`ui/.env.example`](ui/.env.example)). When unset it connects to `ws://<page-hostname>:9090`, which is correct for both local and LAN access.

> [!IMPORTANT]
> rosbridge has no authentication. Keep port 9090 restricted to the machines that should be able to control the robot.

## ROS 2 interface

Everything is defined in `borunte_msgs`. The highlights:

| Interface | Type | Description |
|---|---|---|
| `/robot/state` | topic `RobotState` | Pose, joints, I/O, alarm, connection state (10 Hz) |
| `/sequence/state` | topic `SequenceState` | Running/paused flags, current step, counters (2 Hz + on change) |
| `/robot_driver_node/move_to`, `jog`, `set_output`, `set_speed`, `stop`, `connect`, `clear_alarm`, `rcc_move` | services | Direct robot control |
| `/sequence_engine_node/run_sequence` | action `RunSequence` | Execute a sequence with feedback; cancel = stop |
| `/sequence_engine_node/pause`, `resume`, `step` | services | Mid-run flow control |
| `/data_node/*` | services | 30 services covering points, sequences, pallets, Modbus devices, settings, and projects |
| `/modbus_node/read_register`, `write_register` | services | Read or write one named Modbus register |

The data_node services worth knowing about beyond plain CRUD:

| Service | Why it exists |
|---|---|
| `save_current_point` | Teaches a point from the robot's live pose. Pass `overwrite` to re-teach an existing one in place, keeping its name so every reference follows it. |
| `rename_point` / `rename_sequence` | Renames *and* rewrites every referrer in the same save. Renaming without this would leave steps pointing at a name that no longer resolves. |
| `find_point_usage` | Lists the steps and pallet corners depending on a point — what the UI shows before you re-teach or delete it. |
| `arrange_points` | Stores the operator's ordering and grouping of the point list. Rejects a list that does not name exactly the points that exist. |
| `validate_sequence` | Checks a sequence resolves (points exist, labels defined) without running it. |
| `calc_pallet_position` | Returns the pose of one pallet cell, so the UI can preview a cell without moving. |

Example — run a sequence from the command line:

```bash
ros2 action send_goal /sequence_engine_node/run_sequence \
  borunte_msgs/action/RunSequence "{name: 'Main', loop: false, step_mode: false}" --feedback
```

## Sequence step types

Steps are colour-coded in the editor by the category in the first column, so the shape of a program — where it moves, where it branches — reads without reading each line.

| Category | Type | Behavior |
|---|---|---|
| Move | `move` | Move to a named point (with optional XYZ/UVW offsets, speed) |
| Move | `move_pallet` | Move to a computed pallet cell, index fixed or driven by a counter (speed too) |
| In / Out | `io` | Set a digital output |
| In / Out | `wait` | Delay in milliseconds |
| In / Out | `wait_input` | Block until input condition(s) are met (AND/OR) |
| In / Out | `check_input` | Jump to a label if input condition(s) are met |
| Flow | `label` / `goto` | Jump targets and unconditional jumps |
| Flow | `call_sequence` | Run another sequence as a subroutine (max depth 10) |
| Variable | `set_var` | `dest = A op B` — assign, or add, subtract, multiply, divide. Each operand is a number or another variable |
| Variable | `check_var` | Compare a variable and jump |
| Variable | `math_var` | The older counter form (`set`/`add`/`sub` against a literal). Still runs; the toolbox offers `set_var` instead |
| Device | `modbus_read` | Read a Modbus register into a variable, optionally branching on it |
| Device | `modbus_write` | Write a value to a device, from a literal or another register/counter |
| Device | `modbus_wait` | Block until a register meets a condition (with timeout), storing what it read |
| Message | `print` | Post a message to the operator's Messages panel; counter values can be interpolated into the text |

## Palletizing

A pallet is defined by teaching its corners, and every cell is interpolated from them — including orientation, so a pallet that is not level still produces a correct pose at every cell.

| Points taught | Result |
|---|---|
| P1, P2, P3 | A single `rows × cols` plane. P1 is the origin corner, P2 runs along the columns, P3 along the rows. |
| P1, P2, P3, P4 | The same grid, stacked across `layers` planes. Layer 1 sits on P1's plane, the last layer on P4's, evenly spaced in between. |

Cells are addressed by a 1-based index, which a counter can drive — that is what makes a pick-and-place loop possible: `move_pallet` with the index bound to a counter, and a `math_var` step advancing it each cycle. The in-app guide on the Pallets page shows which corner is which.

## Variables

One kind of number for everything: a count, a computed result, a reading from a device. Declared in the Variables panel beside the sequence editor, referred to by name from any step.

```
Temp       = read from the oven
Fahrenheit = Temp × 1.8 + 32
Count      = Count + 1
```

Variables are **cleared at the start of every run** and shared by every sequence in it — a sub-sequence that counts a pallet cell is counting the same variable its caller reads. Nothing is stored between runs, so there is no starting value to set.

**A variable that nothing has touched reads as 0.** That is what a counter has always done and what existing programs depend on.

**A variable whose assignment *failed* is a different thing, and reading it stops the run.** Almost always this is a Modbus read that could not reach its device. The distinction matters because 0 is a real temperature, a real pressure and a real position: letting a failed read pass as zero would let `if Temp < 60` succeed on a measurement nobody took. A failed read also *clears* whatever the variable held before, so a stale number can never be silently reused.

Arithmetic refuses rather than guessing. Division by zero stops the run naming the divisor; a result that overflows to infinity or is not a number stops it too, because every comparison against `nan` is false — including `!=`, which would make a "jump if different" step quietly stop jumping.

`{Temp}` interpolates into a Show Message step and takes a format: `{Temp:.1f}` prints `23.5` rather than `23.499999999999996`.

**Whole numbers where they are required.** A pallet cell must be an integer. If the variable driving one holds `6.9`, the run stops and says so — it is never truncated to cell 6, which is a real cell the arm would move to without erroring, discovered hours later as a mis-stacked pallet.

## Modbus devices

Configured per project on the **Settings → Modbus** tab: a device is a connection, and a register is one named value on it.

A register is defined once — address, type, scale, unit — and referred to by name from every step, so moving a sensor to a different address is one edit rather than one per step. Renaming a register rewrites every step that uses it, as renaming a point or a sequence does.

### A register is an address, not a value

A Modbus register says *where* a number lives and how to decode it — device, address, type, scale. It does not hold the number. `Read Value` fetches it and stores it in whichever variable the step names, and from there it behaves like any other variable.

### Getting a register right

Three things are easy to get wrong, and none of them produces an error — they produce a plausible wrong number:

- **Address base.** A manual saying `40001` means wire address `0`. The register editor shows both numbers as you type, and the table shows both on every row.
- **Word order.** A 32-bit value spans two registers, and which one holds the high half is not standardised. Reading it the wrong way round returns a different, believable value.
- **Signed vs unsigned.** −5 °C read as unsigned is 65531. Anything that can go negative — temperature, position, torque — must be typed as signed.

The **Test read** button on each row reads that register once and shows both the decoded value and the raw registers. Comparing it against the device's own display is how all three get settled before a sequence depends on them.

### Writing

Writing is opt-in per register and guarded at several points, because a wrong write commands machinery:

- The register must be marked writable, checked at CHECK time before a run can reach it
- A value outside the register's configured range is **refused, not clamped** — clamping would turn a typo into a command nobody chose
- A value that would not fit the raw type is refused rather than wrapping (70000 into a `uint16` silently becoming 4464 is exactly the class of error that moves machinery unexpectedly)
- Every write is read back and confirmed, and a mismatch stops the run
- Writes are never retried: a retried command register can be applied twice

### RTU notes

RTU needs a USB-RS485 adapter and the user in the `dialout` group (`sudo usermod -aG dialout $USER`, then log out and back in). TCP needs neither.

An RS-485 bus carries one transaction at a time, so every device on one port queues behind the others, and a dead device answers with silence rather than an error — the master waits out the full timeout while the rest of the bus waits with it. Timeouts default to 0.5 s with 2 retries rather than pymodbus's own 3 s × 3, which would stall a step for nine seconds. `apt install mbpoll` is worth having to confirm a register map with an independent tool before a sequence depends on it.

## Project structure

```
borunte-control/
├── data/projects/        # Workspaces: points, sequences, pallets, settings (JSON)
├── ecosystem.config.js   # PM2 entry point → ros2 launch
├── ros2_ws/src/
│   ├── borunte_msgs/     # Interface definitions
│   ├── borunte_control/  # robot_driver, sequence_engine, data nodes + SDK
│   └── borunte_bringup/  # Launch file + parameters
└── ui/                   # Next.js operator interface (roslibjs via rosbridge)
```

## Development

```bash
# UI with hot reload, on a second port so the running one keeps serving
cd ui && npm run dev -- -p 8081

# Rebuild a single ROS 2 package after changes
cd ros2_ws && colcon build --packages-select borunte_control --symlink-install

# Launch without the bundled UI
ros2 launch borunte_bringup borunte_bringup.launch.py start_ui:=false
```

> [!TIP]
> With `--symlink-install`, Python node changes take effect on the next restart — no rebuild needed. Interface (`.msg`/`.srv`/`.action`) changes always require a rebuild of `borunte_msgs`.

> [!CAUTION]
> **Do not run `npm run build` while a dev server is up.** The build replaces the contents of `.next/` that the dev server is serving from, and the running UI starts 404-ing on its own assets until it is restarted. Stop the dev server first, or build while nothing is serving.
>
> Note also that `pm2 restart borunte` restarts the ROS 2 stack, which drops the robot connection. On a machine attached to a live robot, prefer rebuilding and restarting only what changed.
