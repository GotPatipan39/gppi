# Cross-Layer System Diagnostics

Adapted from ros2-engineering-skills (Apache-2.0) @ 4ee4dea for ROS 2 Humble — see ../CHANGELOG.md

Most ROS 2 failures that survive a code review are not ROS bugs. They start outside the
graph — an RS-485 line picks up noise, a PLC's Ethernet link flaps, a Modbus call
blocks, a USB adapter renumbers, the clock steps — and arrive as a ROS symptom several
layers away from the cause. The node that logs the loudest error is usually the last
link in the chain, not the broken one.

This file is a **diagnostic pointer**: how to trace a symptom back across layer
boundaries, and which boundary to instrument. It does not document the non-ROS stacks
themselves — for Modbus/RS-485/PLC details use skill `modbus`; for cameras, skill
`opencv`.

The diagnosis steps here are read-only (recording, `ros2 topic hz`, logs). Anything
that restarts a node, reactivates a lifecycle node, reconnects a device or opens a
serial port that is in use changes what the machine does — Claude must ask the user
first, and on a real machine only with explicit instruction.

## Table of contents

1. [The shape of a cross-layer failure](#1-the-shape-of-a-cross-layer-failure)
2. [Bisect by first stop, not by loudest error](#2-bisect-by-first-stop-not-by-loudest-error)
3. [Instrument the boundaries](#3-instrument-the-boundaries)
4. [Bridge nodes: executors meeting blocking I/O](#4-bridge-nodes-executors-meeting-blocking-io)
5. [Symptom to layer table](#5-symptom-to-layer-table)
6. [Common failures and fixes](#6-common-failures-and-fixes)

---

## 1. The shape of a cross-layer failure

A typical chain on a machine with a Modbus TCP PLC and a servo drive:

```text
PLC Ethernet link flaps (loose connector, switch reboot)
  → Modbus TCP read in the bridge node waits for its full response timeout
    → the bridge's single-threaded executor is blocked; its other timers stop too
      → /joint_states and odometry stop; odom→base_link TF stops
        → consumers time out: TF extrapolation errors, controller aborts
          → command watchdog stops motion; HMI shows "machine error"
```

Every arrow crosses a layer, and every layer reports the failure in its own vocabulary.
The controller's error is truthful and useless: it really did lose TF, for a reason four
layers upstream. Three properties make this class of failure hard:

- **The error surfaces where the data is consumed, not where it was lost.** Consumers
  have the assertions; producers just go quiet.
- **Silence propagates faster than errors.** A stopped publisher is not an exception
  anywhere — downstream nodes simply time out one after another, producing a cascade of
  unrelated-looking messages.
- **Recovery is not symmetric.** The link returns and the bridge reconnects, but a
  lifecycle node that went to an error state, stale latched data, or a controller that
  aborted may not come back without intervention.

## 2. Bisect by first stop, not by loudest error

The diagnostic question is always **which producer went quiet first**, in wall time.
Answer it from recorded data, not from live poking — the failure is usually
intermittent.

Record the chain's boundaries continuously, so any incident is already captured
(subscribing does not move the machine):

```bash
# Every producer along the suspected chain, small and cheap
ros2 bag record -o incident \
  /tf /tf_static /diagnostics /rosout \
  /joint_states /odom /plc/status \
  --max-bag-duration 300
```

**`--max-bag-duration` splits the recording; it does not bound total disk use.** It
starts a new file every N seconds and keeps every previous one, so left running it fills
the disk — which on the mini PC takes down more than the recording. Humble's
`ros2 bag record` has `--max-bag-size`, `--max-bag-duration` and `--max-cache-size`, but
**no retention option** (no `--max-bag-files`; that does not exist in the Humble
recorder —
[ros2bag record.py, humble](https://github.com/ros2/rosbag2/blob/humble/ros2bag/ros2bag/verb/record.py)).
Bound the disk outside rosbag2: a cron/systemd timer that deletes the oldest split
files, a dedicated partition, or a supervisor that restarts the recorder into a new
directory. Check what the installed version offers:

```bash
ros2 bag record --help | grep -i 'max-'
```

Then order the last message on each topic:

```bash
ros2 bag info incident        # per-topic message counts and duration
```

For an exact ordering, read the bag programmatically and print the final timestamp per
topic (`debugging.md` §5 has the `SequentialReader` pattern — on Humble the default
storage is `sqlite3`, so use `storage_id='sqlite3'` unless you recorded with
`-s mcap`). The topic whose last message is *earliest* is closest to the cause;
everything that stopped after it is a consequence.

`/rosout` in the same bag puts log lines on the same timeline as the data, so the
bridge's reconnect attempts and the first TF failure can be ordered.

Two rules that keep this honest:

- **Compare message timestamps, not receive order**, and confirm all nodes agree on the
  clock (`use_sim_time`, NTP — `system-bringup.md` §3). A clock step looks exactly like
  a stalled producer.
- **A rate drop is a stop.** Controllers and odometry fail at *degraded* rates well
  before zero. Compare against each producer's nominal rate (`ros2 topic hz`) rather
  than checking only for absence.

## 3. Instrument the boundaries

Every place data enters or leaves the ROS graph deserves a health signal published *by
the node that owns the boundary*, using `diagnostic_updater` (`debugging.md` §1):

| Boundary | Publish | Fails as |
|---|---|---|
| Modbus TCP to PLC | connected, last successful transaction, timeouts, reconnect count | topics go quiet, no error |
| Modbus RTU / RS-485 | transactions/s, CRC and timeout errors per slave ID, reopen count | partial data, plausible but wrong values |
| Servo drive | drive alarm code, enabled state, following error (as the drive reports it) | motion stops with only a generic error in ROS |
| USB serial / camera | device present, reopen count, frame/byte rate | sudden silence after a replug or EMI event |
| Time sync | sync state, offset (`timedatectl` / `chronyc tracking`) | TF extrapolation errors, bag replay skew |
| Compute host | CPU load, temperature/throttling, free disk and memory | rate drops that look like link loss |

Register addresses, slave IDs and alarm-code meanings come from the project's
`CLAUDE.md` and the device datasheet — never guessed.

The point is not dashboards. When a chain breaks, the answer to "which layer" should
already be in `/diagnostics` and in the bag, instead of being reconstructed from a
machine that is now standing still.

Boundary nodes should also **report degraded, not just failed**: a bridge that is
reconnecting is different from one that is down, and consumers (or the HMI) can react —
stop accepting new jobs — before the data disappears.

A PLC or servo drive decides from internal state you cannot see on ROS topics. Do not
infer why it stopped from the graph alone. Read its own alarm/fault history (PLC error
log, drive alarm history), align it with the recorded ROS data by timestamp (same clock
check as §2), and record which internal check fired, not only that the machine stopped.

## 4. Bridge nodes: executors meeting blocking I/O

The node that owns a boundary runs a ROS 2 executor *and* blocking I/O (libmodbus,
serial reads, a vendor SDK with its own threads). This is where the same failure keeps
being reintroduced:

- **Blocking the executor.** A Modbus read that waits for its response timeout, a
  reconnect with a retry sleep, or a long serial read inside a timer or subscription
  callback stops *every* callback in that executor — including the command watchdog and
  heartbeat the safety layer depends on. Keep device I/O in its own timer and callback
  group with a `MultiThreadedExecutor`, or in a dedicated thread that hands data across
  under a mutex (`nodes-executors.md`). Bound every I/O call with a timeout. Once I/O
  has its own thread, liveness signals (systemd watchdog ping, heartbeat topic) must
  come from — or be gated by — that I/O loop's progress, not from a timer that keeps
  running while the I/O thread is stuck (`deployment.md` §5).
- **One bus, one owner.** An RS-485 bus or a PLC connection is owned by exactly one
  node (`SKILL.md`). A second process polling the same bus — a debug script, a manual
  `ros2 run` next to the service — produces collisions that look like noise. Check who
  holds the port (`runtime-provenance.md` §2) and ask before opening it.
- **Reconnect storms.** Retry with bounded exponential backoff. An unbounded retry loop
  competes for the same degraded link and can turn a recoverable dropout into a
  permanent one.
- **State on reconnect.** After the link returns, decide explicitly what is stale:
  latched topics need republishing, lifecycle nodes may need reactivation, and buffered
  commands must **not** be replayed — require a fresh command after any gap
  (`safety-estop.md` §5).

A bridge node is a resource-owning node: lifecycle transitions give the system a
defined way to take it out of service when the far side is gone, instead of leaving a
half-connected node publishing stale data (`lifecycle-components.md`,
`hardware-interface.md` §10).

## 5. Symptom to layer table

The ROS-visible symptom, the layer that usually caused it, and how to confirm it before
changing configuration.

| ROS symptom | Suspect first | Confirm with |
|---|---|---|
| TF extrapolation errors | the producer feeding that TF edge stopped | last-message ordering in the bag; `ros2 run tf2_ros tf2_monitor` |
| Topic rate drops but never reaches zero | slow device responses, CPU throttle, or RELIABLE retransmits | `ros2 topic hz`, `/diagnostics` link stats, `uptime` / temperature |
| All data from one device stops at once | link or connection down | bridge `/diagnostics`, bridge log in `journalctl`/`pm2 logs` |
| Values plausible but wrong | wrong slave ID/register, CRC/framing errors, or a renumbered USB device | driver error counters; `ls -l /dev/serial/by-id/` (`system-bringup.md` §2) |
| Timestamps jump or go backwards | clock step, or mixed `use_sim_time` | `timedatectl` / `chronyc tracking`; check `use_sim_time` on each node |
| Node alive, callbacks stopped | executor blocked by device I/O | thread backtrace (see note below); check callback groups |
| Everything recovers except one node | lifecycle node in error state, or stale latched data | `ros2 lifecycle get /<node>`; re-check latched topics after reconnect |
| Behavior differs after a reconnect or restart | stale config, or a duplicate process | `runtime-provenance.md` §8 |
| Machine stops; topics only show the effect | PLC interlock or drive alarm fired | timestamp-align the PLC/drive alarm log with the bag (§3) |

Note on thread backtraces: `gdb -p <pid> -batch -ex 'thread apply all bt'` **pauses**
the process while it attaches. Pausing a hardware node stops its control loop (the
device's communication timeout should then stop the machine). Ask the user before
attaching to a node that drives hardware; prefer doing it with the machine in a safe
state.

## 6. Common failures and fixes

| Symptom | Why it happens | Fix |
|---|---|---|
| Diagnosis chases the node that logged the error | The consumer asserts; the producer goes silent | Order producers by last message time; fix the earliest stop |
| "It only happens on the machine" | The failing layer (cable, EMI, PLC, thermal) is not on the desk | Record boundary diagnostics continuously so incidents are captured |
| Post-incident analysis has no data | Nothing was recording | Record the chain's boundaries continuously with external disk rotation (§2) |
| Continuous recording fills the disk | `--max-bag-duration` splits but keeps every file; Humble has no retention option | Rotate/delete old splits outside rosbag2, or cap the partition |
| Watchdog/heartbeat stops whenever the link degrades | Bridge blocks the executor during I/O or reconnect | Separate callback group or thread; bounded timeouts and backoff; never sleep in a callback |
| Link returns but the system stays broken | Lifecycle node in error, latched data stale, no republish | Define reconnect semantics explicitly; reactivate (ask first) and republish |
| Machine resumes a pre-dropout command | Queued command delivered after reconnect | Require a fresh command after any gap; LIFESPAN on command topics (`safety-estop.md` §5) |
| Random CRC errors / timeouts on RS-485 | Second master on the bus, wiring/termination, or wrong baud/parity | Check for duplicate processes first (`runtime-provenance.md` §8), then skill `modbus` |

---

**See also:** `runtime-provenance.md` for "what is actually running",
`debugging.md` for rosbag2, tracing and DDS-level tools,
`system-bringup.md` for udev, boot ordering, time sync and watchdogs,
`nodes-executors.md` for executor and callback-group behavior,
`safety-estop.md` for stop paths and recovery semantics.
