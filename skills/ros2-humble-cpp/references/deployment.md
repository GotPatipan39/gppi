# Deployment

Adapted from ros2-engineering-skills (Apache-2.0) @ 4ee4dea for ROS 2 Humble — see ../CHANGELOG.md

Target for this file: a ROS 2 **Humble** C++ stack built on a dev machine (Windows + WSL
Ubuntu 22.04) and run on a **mini PC with Ubuntu 22.04** next to the machine, started by
**systemd** or **pm2**. Device names, IPs, slave IDs and `ROS_DOMAIN_ID` values in this
file are placeholders — take the real values from the project's `CLAUDE.md`, never guess.

> **Before running anything here:** any step that starts or restarts a service, runs
> `ros2 launch` with real drivers, or swaps the installed build can make the machine
> move. Claude must ask the user first and must not run these on a production/real
> machine unless the user explicitly asked for it in that message.

## Table of contents

1. Getting the build onto the mini PC
2. Containers (optional)
3. Mini PC resource notes
4. Updating a machine and rolling back
5. systemd service configuration (with `sd_notify`) and pm2
6. Environment variable management
7. Security (SROS2)
8. Monitoring and health checks
9. Graceful shutdown
10. Common failures and fixes

---

## 1. Getting the build onto the mini PC

Two workable options. Both require the dev machine and the mini PC to be the **same**
Ubuntu 22.04 + ROS 2 Humble (same architecture, same apt package versions as far as
possible).

| Option | How | When |
|---|---|---|
| Build on the mini PC | `git pull` + `colcon build` on the target — **into a new release dir (§4), never over the workspace the running service sources**; ask the user first | Simplest; the mini PC has the toolchain and enough RAM |
| Build in WSL, copy `install/` | `colcon build` **without** `--symlink-install`, then copy `install/` | Target has no build tools or no internet |

```bash
# On the dev machine (WSL), release build for deployment
source /opt/ros/humble/setup.bash
cd ~/robot_ws
colcon build --cmake-args -DCMAKE_BUILD_TYPE=Release
```

Rules for the copy option:

- **Never copy a `--symlink-install` tree.** Its launch/config/Python files are symlinks
  into `src/` on the dev machine; on the target they dangle (see
  `runtime-provenance.md` §4).
- **Keep the same absolute workspace path on both machines** (e.g. build in
  `/opt/robot/ws` or bind the same path). Some generated files (CMake config, package
  hooks) contain the install prefix; a matching path avoids surprises. If the paths
  must differ, test on the target before trusting it.
- Install runtime dependencies on the target at **setup time** with
  `rosdep install --from-paths src --ignore-src -y` (needs the `src/` tree and apt
  access) or from prepared `.deb` files — never at boot.
- Copying the new tree onto a running machine is a deployment step: ask first (see §4
  for the switch-over pattern).

## 2. Containers (optional)

Most projects on this team run directly on the host via systemd/pm2. If a project does
use Docker, keep it to these Humble-specific points:

```dockerfile
# Multi-stage: build tools stay out of the runtime image
FROM ros:humble AS builder
WORKDIR /ros2_ws
COPY src/ src/
RUN apt-get update && rosdep update && \
    rosdep install --from-paths src --ignore-src -y && \
    rm -rf /var/lib/apt/lists/*
RUN . /opt/ros/humble/setup.sh && \
    colcon build --cmake-args -DCMAKE_BUILD_TYPE=Release

FROM ros:humble-ros-core AS runtime
COPY --from=builder /ros2_ws/install /ros2_ws/install
# Install runtime deps here (rosdep with the src tree, or explicit apt packages)
ENV ROS_LOCALHOST_ONLY=1
# ROS_DOMAIN_ID: pass at run time from the project's CLAUDE.md (docker run -e ROS_DOMAIN_ID=...)
```

```bash
#!/bin/bash
# entrypoint.sh
set -e
source /opt/ros/humble/setup.bash
source /ros2_ws/install/setup.bash
exec "$@"
```

- Use `network_mode: host` (or `--network host`) so DDS discovery and
  `ROS_LOCALHOST_ONLY=1` behave the same as on the host; with a bridge network the
  container's "localhost" is not the host's.
- Pass serial devices by their **udev symlink** (`--device /dev/plc_rs485`, see
  `system-bringup.md` §2), not `/dev/ttyUSB0`.
- `docker run` / `docker compose up` of an image that contains a driver is the same as
  launching the driver: ask the user first.

## 3. Mini PC resource notes

- Install `ros-humble-ros-base` on the mini PC (no GUI); add only the packages the
  stack needs.
- Build with `-DCMAKE_BUILD_TYPE=Release` for deployment; Debug builds of control loops
  can be several times slower.
- On a small machine, limit build parallelism: `colcon build --parallel-workers 2`
  (and `MAKEFLAGS=-j2`), or build in WSL and copy (§1).
- Consider `component_container` for many small nodes (one process, intra-process
  comms) — see `lifecycle-components.md`.
- Keep `ROS_LOCALHOST_ONLY=1` (§6): besides isolation, it removes LAN discovery traffic.

## 4. Updating a machine and rolling back

Keep each release in its own directory and switch a symlink, so rollback is one step
and the previous build is still on disk:

```text
/opt/robot/
├── releases/
│   ├── 2026-10-01_v1.4.0/install/
│   └── 2026-10-14_v1.5.0/install/
├── ws -> releases/2026-10-14_v1.5.0     # what the service sources
├── config/                               # machine-specific overrides, not in the release
└── scripts/start_layer.sh
```

Procedure (each step is done by, or with explicit approval from, the user — switching
the release and restarting the service makes the new code drive the machine):

1. Copy the new release to `releases/<date>_<version>/` while the old one keeps running.
2. Record what is being deployed: git commit, version, and
   `sha256sum` of the installed executables/configs (`runtime-provenance.md` §4).
3. Put the machine in a safe state (stopped, no motion, E-stop available).
4. Switch: `ln -sfn releases/2026-10-14_v1.5.0 /opt/robot/ws`, then restart the service.
5. Verify at graph level (`system-bringup.md` §5), then with hardware at low speed /
   no load before declaring it in service.
6. Rollback = repeat steps 3–5 with the old release: safe state first, then point the
   symlink back and restart, then verify at low speed / no load — a rollback usually
   happens in a hurry on a misbehaving machine, which is exactly when skipping the safe
   state hurts. `config/` lives outside the release: check the old release still
   understands it (parameter names, scale, units) before restarting.

Record a manifest next to each release so "what is on this machine" has an answer:

```yaml
# releases/2026-10-14_v1.5.0/manifest.yaml
machine_id: <from project CLAUDE.md>
software_version: 1.5.0
git_commit: <hash>
ros_distro: humble
packages:
  my_robot_bridge: 1.5.0
  my_robot_bringup: 1.5.0
```

## 5. systemd service configuration

> **Running these commands:** `systemctl start/restart/stop` of a service that runs
> drivers can make the machine move (or stop it mid-motion). Claude must ask the user
> first; on production/real machines only with explicit instruction in that message.
> Read-only commands (`systemctl status`, `journalctl`) are fine.

### Launch wrapper script

`system-bringup.md` §3 uses `ExecStart=/opt/robot/scripts/start_layer.sh <layer>`. A
working version for Humble:

```bash
#!/bin/bash
# /opt/robot/scripts/start_layer.sh — source the environment, then exec launch
# No `set -u`: ROS setup scripts reference unset variables.
set -eo pipefail

source /opt/ros/humble/setup.bash
source /opt/robot/ws/install/setup.bash

case "${1:-}" in
  base)     exec ros2 launch my_robot_bringup base.launch.py ;;
  autonomy) exec ros2 launch my_robot_bringup autonomy.launch.py ;;
  *) echo "usage: $0 base|autonomy" >&2; exit 2 ;;
esac
```

`exec` matters: `ros2 launch` becomes the unit's main process (not a bash wrapper),
so systemd's signals and exit status reach it directly.

### Option A (simplest): `Type=simple` + `Restart=`

Use this unless you need systemd to detect a *hung* process.

```ini
# /etc/systemd/system/ros2-base.service
[Unit]
Description=ROS 2 base drivers
Wants=network-online.target
After=network-online.target
StartLimitIntervalSec=60
StartLimitBurst=3

[Service]
Type=simple
User=robot_user
Group=robot_user

# ROS 2 environment — must match every other process on this machine
Environment=ROS_LOCALHOST_ONLY=1
# Take the value from the project's CLAUDE.md; do not guess
Environment=ROS_DOMAIN_ID=<DOMAIN_ID_FROM_PROJECT_CLAUDE_MD>
Environment=RMW_IMPLEMENTATION=rmw_fastrtps_cpp

ExecStart=/opt/robot/scripts/start_layer.sh base

# Auto-restart is OFF in this template on purpose — enable only after confirming the
# conditions in the notes below (safe start state + device-side comm timeout):
# Restart=on-failure
# RestartSec=5

# Graceful shutdown — see §9
KillSignal=SIGINT
TimeoutStopSec=20

StandardOutput=journal
StandardError=journal
SyslogIdentifier=ros2-base

[Install]
WantedBy=multi-user.target
```

Notes:

- `StartLimitIntervalSec`/`StartLimitBurst` belong in `[Unit]` on current systemd
  (Ubuntu 22.04 ships systemd 249). Add `OnFailure=` escalation as in
  `system-bringup.md` §4.
- `Restart=on-failure` (commented out above) restarts a driver automatically, with no one
  watching. That is only acceptable if the driver starts in a **safe state** (no motion
  until it receives a fresh command after start) and the device has its own
  communication timeout. Check both, with the user, before enabling.
- `StartLimitBurst=3` in 60 s does **not** stop every crash loop: a driver that crashes
  after ~30 s of running restarts only twice per 60 s and never hits the limit. For a
  hardware driver, prefer `OnFailure=` (alert, stay down) and a human restart over
  unattended restarts.
- `RMW_IMPLEMENTATION` is optional (Humble's default is `rmw_fastrtps_cpp`); if set,
  set it identically everywhere.

### Option B: `Type=notify` + `WatchdogSec` (the pattern in `system-bringup.md` §3)

`Type=notify` means the unit is "started" only when the program sends `READY=1`, and
`WatchdogSec=` makes systemd kill and restart the service if `WATCHDOG=1` stops
arriving. Two details make this work with `ros2 launch`:

1. **`NotifyAccess=all` is required.** The node that calls `sd_notify()` is a *child*
   of `ros2 launch`, not the main process. With `Type=notify` the default is
   effectively `NotifyAccess=main`, which silently ignores notifications from children
   — the unit then times out on start, or is killed by the watchdog.
   ([systemd.service(5)](https://man7.org/linux/man-pages/man5/systemd.service.5.html), `NotifyAccess=`)
2. **Read `WATCHDOG_USEC` directly; do not rely on `sd_watchdog_enabled()`.** systemd
   sets `WATCHDOG_PID` to the main PID (`ros2 launch`); in a child process
   `sd_watchdog_enabled()` ignores the watchdog variables because the PID does not
   match. ([sd_watchdog_enabled(3)](https://man7.org/linux/man-pages/man3/sd_watchdog_enabled.3.html))
   `ros2 launch` passes its environment (including `NOTIFY_SOCKET` and
   `WATCHDOG_USEC`) to the nodes it starts by default
   ([launch `LaunchContext.environment` returns `os.environ`](https://github.com/ros2/launch/blob/humble/launch/launch/launch_context.py)).

```ini
# /etc/systemd/system/ros2-base.service — Type=notify variant
[Service]
Type=notify
NotifyAccess=all
User=robot_user
Environment=ROS_LOCALHOST_ONLY=1
Environment=ROS_DOMAIN_ID=<DOMAIN_ID_FROM_PROJECT_CLAUDE_MD>
ExecStart=/opt/robot/scripts/start_layer.sh base
# Time allowed between start and READY=1 (hardware connect included)
TimeoutStartSec=60
WatchdogSec=30
# Restart=on-failure   # same conditions as Option A — off until confirmed
# RestartSec=5
KillSignal=SIGINT
TimeoutStopSec=20
```

> **Watchdog kill sends no stop.** When `WatchdogSec` expires, systemd sends
> `WatchdogSignal` (default `SIGABRT`), not `SIGINT` — the §9 shutdown path does not
> run, nothing is sent to the device, and until the kill (up to `WatchdogSec`) the
> last command stays active. Option B therefore **requires a device-side
> communication timeout** (drive/PLC) before it is enabled; it detects a hung process,
> it does not stop the machine.

**Exactly one node** in the unit sends `READY=1` and `WATCHDOG=1` — normally the
hardware bridge node. If several nodes ping, one healthy node masks another that hung.

C++ side (Humble, rclcpp, libsystemd from Ubuntu 22.04):

```cmake
# CMakeLists.txt
find_package(PkgConfig REQUIRED)
pkg_check_modules(SYSTEMD REQUIRED libsystemd)

target_include_directories(my_bridge_node PRIVATE ${SYSTEMD_INCLUDE_DIRS})
target_link_libraries(my_bridge_node ${SYSTEMD_LIBRARIES})
```

```xml
<!-- package.xml — rosdep key libsystemd-dev exists in rosdistro base.yaml -->
<depend>libsystemd-dev</depend>
```

```cpp
// systemd_notify.hpp — small helper, no rclcpp dependency
#pragma once
#include <systemd/sd-daemon.h>
#include <chrono>
#include <cstdlib>
#include <optional>

// Watchdog timeout configured by systemd (WatchdogSec=), or nullopt when not
// running under a systemd watchdog (dev machine, pm2, manual ros2 run).
inline std::optional<std::chrono::microseconds> systemd_watchdog_timeout()
{
  const char * s = std::getenv("WATCHDOG_USEC");
  if (s == nullptr) { return std::nullopt; }
  char * end = nullptr;
  const unsigned long long usec = std::strtoull(s, &end, 10);
  if (end == s || *end != '\0' || usec == 0) { return std::nullopt; }
  return std::chrono::microseconds(usec);
}

// sd_notify() returns 0 and does nothing when NOTIFY_SOCKET is unset,
// so these are safe to call outside systemd.
inline void systemd_ready() { sd_notify(0, "READY=1"); }
inline void systemd_watchdog_ping() { sd_notify(0, "WATCHDOG=1"); }
```

```cpp
// In the bridge node (sketch)
#include "my_pkg/systemd_notify.hpp"

MyBridgeNode::MyBridgeNode() : Node("my_bridge")
{
  // ... declare parameters, create pubs/subs ...
  if (auto t = systemd_watchdog_timeout()) {
    watchdog_ping_period_ = std::chrono::duration_cast<std::chrono::nanoseconds>(*t) / 2;
  }
  timer_ = create_wall_timer(20ms, [this]() { control_cycle(); });
}

void MyBridgeNode::control_cycle()
{
  // The real work loop: read device, apply watchdog/ramp/clamp, write device.
  // It must keep running (and attempt reconnects with backoff) even while the
  // device is disconnected — device loss is reported on /diagnostics, it is not
  // a reason for systemd to kill the process.
  poll_device_and_update();

  if (!ready_sent_ && initial_setup_done_) {
    systemd_ready();          // unit becomes "active" only now
    ready_sent_ = true;
  }

  // Ping from the work loop itself, not from a separate timer: if this callback
  // stops running (deadlock, blocked executor), the pings stop and systemd restarts.
  // If device I/O runs in its own thread / callback group (system-diagnostics.md §4),
  // pinging here proves nothing about the I/O: ping only if the I/O loop completed a
  // cycle recently (e.g. an atomic heartbeat counter it bumps each cycle, checked here).
  if (watchdog_ping_period_.count() > 0) {
    const auto now = std::chrono::steady_clock::now();
    if (now - last_ping_ >= watchdog_ping_period_) {
      systemd_watchdog_ping();
      last_ping_ = now;
    }
  }
}
```

Choosing when to send `READY=1`: after parameters are validated and the node is ready
to accept commands (for a lifecycle node, at the end of a successful `on_activate`).
Whether READY should also wait for a first successful device read is a project
decision — if it does, `TimeoutStartSec` must cover the device's connect time.

The systemd watchdog detects a *hung process*, nothing more. It does not see a stalled
publisher thread or a device that stopped answering — those need the topic-level
watchdog and `/diagnostics` in `system-bringup.md` §4–5. Check the systemd pattern's
behavior with `systemctl status` / `journalctl` on a bench setup before relying on it.

### Managing the service

```bash
# Read-only — fine to run
systemctl status ros2-base
journalctl -u ros2-base -b -f

# Changes machine state — ask the user first; real machines only on explicit instruction
sudo systemctl daemon-reload          # after editing unit files
sudo systemctl enable ros2-base       # start at boot
sudo systemctl start ros2-base
sudo systemctl restart ros2-base
```

### pm2 alternative

pm2 has no `sd_notify` watchdog; liveness comes from the topic-level watchdog
(`system-bringup.md` §4). Two settings need care:

- pm2 stops a process with **SIGINT**, then **SIGKILL after 1.6 s** by default
  ([pm2 signals](https://pm2.keymetrics.io/docs/usage/signals-clean-restart/)). That
  is often too short for `ros2 launch` and the nodes to send a stop to the device —
  raise `kill_timeout`.
- Set the ROS environment in `env:`, identical to every other process on the machine.

```js
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'ros2-base',
    script: '/opt/robot/scripts/start_layer.sh',
    args: 'base',
    interpreter: '/bin/bash',
    env: {
      ROS_LOCALHOST_ONLY: '1',
      ROS_DOMAIN_ID: '<DOMAIN_ID_FROM_PROJECT_CLAUDE_MD>',   // from the project's CLAUDE.md
    },
    kill_timeout: 20000,      // ms before SIGKILL — give shutdown time to stop the device
    autorestart: false,       // OFF until confirmed: safe start state + device comm timeout (Option A notes)
    restart_delay: 5000,      // ms between restarts (when autorestart is enabled)
    min_uptime: 10000,        // shorter runs count as unstable restarts
    max_restarts: 5,          // counts only restarts within min_uptime — a crash after 10 s loops forever
  }],
};
```

```bash
# Read-only
pm2 status
pm2 logs ros2-base

# Start/restart the stack — ask the user first; real machines only on explicit instruction
pm2 start ecosystem.config.js
pm2 restart ros2-base
pm2 save && pm2 startup     # start at boot (pm2 itself runs from a systemd unit)
```

## 6. Environment variable management

### Essential variables on Humble

| Variable | Purpose | Humble default |
|---|---|---|
| `ROS_LOCALHOST_ONLY` | `1` = DDS traffic stays on this machine | `0` |
| `ROS_DOMAIN_ID` | DDS domain isolation (0–101 is safe on Linux) | `0` |
| `RMW_IMPLEMENTATION` | Middleware selection | `rmw_fastrtps_cpp` |
| `CYCLONEDDS_URI` / `FASTRTPS_DEFAULT_PROFILES_FILE` | DDS vendor config file | none |
| `ROS_LOG_DIR` | Log file directory | `~/.ros/log` |
| `RCUTILS_CONSOLE_OUTPUT_FORMAT` | Log line format | `[{severity}] [{time}] [{name}]: {message}` |
| `RCUTILS_COLORIZED_OUTPUT` | Colors in console output (`0` for journald) | auto |

Team default (see `SKILL.md`): **`ROS_LOCALHOST_ONLY=1` and the project's
`ROS_DOMAIN_ID`** in every process — shell, `~/.bashrc`, systemd `Environment=`, pm2
`env:`. A process with different values sees nothing and reports no error. Multi-machine
ROS traffic only when the project's `CLAUDE.md` says so. Modbus TCP to a PLC is not
affected by `ROS_LOCALHOST_ONLY`.

### Not on Humble: `ROS_AUTOMATIC_DISCOVERY_RANGE`

`ROS_AUTOMATIC_DISCOVERY_RANGE` and `ROS_STATIC_PEERS` were introduced in **Iron**,
where `ROS_LOCALHOST_ONLY` was deprecated
([Iron release notes](https://docs.ros.org/en/iron/Releases/Release-Iron-Irwini.html),
[Improved Dynamic Discovery](https://docs.ros.org/en/iron/Tutorials/Advanced/Improved-Dynamic-Discovery.html)).
Humble does not read them — setting them on Humble does nothing. Use
`ROS_LOCALHOST_ONLY=1`.

### Per-machine configuration

Keep machine-specific values out of the release (they survive updates, §4):

```bash
# /opt/robot/config/env.sh — values from the project's CLAUDE.md
export ROS_LOCALHOST_ONLY=1
export ROS_DOMAIN_ID=<DOMAIN_ID_FROM_PROJECT_CLAUDE_MD>
export PLC_RS485_PORT=/dev/plc_rs485      # udev symlink, system-bringup.md §2
```

For systemd, the same values go in `Environment=` lines or an
`EnvironmentFile=/opt/robot/config/robot.env` (plain `KEY=value` lines, no `export`).

### ROS 2 daemon

The CLI daemon caches discovery for `ros2 topic list`, `ros2 node list`, etc. It keeps
the `ROS_DOMAIN_ID` / `ROS_LOCALHOST_ONLY` / `RMW_IMPLEMENTATION` it was started with:

```bash
ros2 daemon stop      # after changing any of those variables
ros2 daemon status
ros2 node list --no-daemon    # bypass the cache entirely
```

## 7. Security (SROS2)

With `ROS_LOCALHOST_ONLY=1`, ROS traffic does not leave the machine, which is the
team's main protection. If a project's `CLAUDE.md` enables multi-machine ROS traffic,
consider SROS2 (DDS authentication, access control, encryption). Humble commands:

```bash
ros2 security create_keystore ~/sros2_keystore
ros2 security create_enclave ~/sros2_keystore /my_robot/bridge
export ROS_SECURITY_KEYSTORE=~/sros2_keystore
export ROS_SECURITY_ENABLE=true
export ROS_SECURITY_STRATEGY=Enforce
```

Test in an isolated, non-actuating setup first. The default enclave permissions are
broad — replace them with the intended policy and test both allowed and denied
operations. `Permissive` can fall back to unsecured operation and is not an
access-control test. See `safety-estop.md` §4 for isolating the e-stop path.

## 8. Monitoring and health checks

`systemctl status` only says the process is up. Health is "the right topics are
flowing at the right rate" and "devices report OK on `/diagnostics`":

- Hardware nodes publish `/diagnostics` with `diagnostic_updater`
  (`debugging.md` §1); aggregate with `diagnostic_aggregator`
  (`system-bringup.md` §5).
- A boot-time check script verifies nodes and data flow (`system-bringup.md` §5).
- An HMI/dashboard should read `/diagnostics_agg` or a health service, not just
  "process is running" (see skill `industrial-ui`).

Illustrative C++ health service (sketch, not a tested program) — reports which
monitored topics are stale:

```cpp
#include <rclcpp/rclcpp.hpp>
#include <sensor_msgs/msg/joint_state.hpp>
#include <std_srvs/srv/trigger.hpp>

class HealthMonitor : public rclcpp::Node
{
public:
  HealthMonitor() : Node("health_monitor")
  {
    timeout_ = std::chrono::duration<double>(declare_parameter("joint_states_timeout_s", 1.0));
    sub_ = create_subscription<sensor_msgs::msg::JointState>(
      "/joint_states", rclcpp::SensorDataQoS(),
      [this](sensor_msgs::msg::JointState::ConstSharedPtr) {
        last_seen_ = std::chrono::steady_clock::now();   // steady clock, not ROS time
        seen_ = true;
      });
    srv_ = create_service<std_srvs::srv::Trigger>(
      "~/health_check",
      [this](const std::shared_ptr<std_srvs::srv::Trigger::Request>,
             std::shared_ptr<std_srvs::srv::Trigger::Response> res) {
        const auto age = std::chrono::steady_clock::now() - last_seen_;
        if (!seen_) {
          res->success = false; res->message = "/joint_states: never received";
        } else if (age > timeout_) {
          res->success = false; res->message = "/joint_states: timeout";
        } else {
          res->success = true; res->message = "OK";
        }
      });
  }

private:
  std::chrono::duration<double> timeout_;
  std::chrono::steady_clock::time_point last_seen_{};
  bool seen_{false};
  rclcpp::Subscription<sensor_msgs::msg::JointState>::SharedPtr sub_;
  rclcpp::Service<std_srvs::srv::Trigger>::SharedPtr srv_;
};
```

Calling `~/health_check` on this node is read-only. Do not reuse this pattern by
`ros2 service call` against a driver's services without checking what they do.

## 9. Graceful shutdown

### The problem

On `systemctl stop/restart` systemd sends `KillSignal` (default `SIGTERM`) to every
process in the unit and waits `TimeoutStopSec` (default 90 s) before `SIGKILL`. pm2
sends `SIGINT`, then `SIGKILL` after `kill_timeout` (default 1.6 s). A process killed
with `SIGKILL` runs no cleanup: the last command written to a drive or PLC stays in
effect until the device's own communication timeout (if it has one) acts.

### systemd settings

```ini
[Service]
KillSignal=SIGINT       # same signal as Ctrl-C; ros2 launch and rclcpp both handle it
TimeoutStopSec=20       # > launch's escalation (SIGTERM after 5 s, SIGKILL after 5 s more)
SendSIGKILL=yes         # still force-kill if shutdown hangs
```

With the default `KillMode=control-group`, `SIGINT` reaches `ros2 launch` and every node
at the same time. Humble's `rclcpp::init()` installs handlers for both `SIGINT` and
`SIGTERM` ([rclcpp humble signal_handler.cpp](https://github.com/ros2/rclcpp/blob/humble/rclcpp/src/rclcpp/signal_handler.cpp)),
so `rclcpp::spin()` returns in each node. `ros2 launch` escalates to `SIGTERM` and then
`SIGKILL` on children that are still alive, 5 s each by default (`sigterm_timeout`,
`sigkill_timeout` launch arguments,
[execute_local.py](https://github.com/ros2/launch/blob/humble/launch/launch/actions/execute_local.py)).

### Humble: send the stop yourself

On Humble, a `LifecycleNode` is **not** transitioned through `on_deactivate`/
`on_shutdown` automatically when the process receives `SIGINT`; the "shutdown in
destructor" behavior was only attempted in Jazzy and later (and reverted more than once —
[rclcpp_lifecycle changelog](https://docs.ros.org/en/jazzy/p/rclcpp_lifecycle/CHANGELOG.html)).
After the signal, the ROS context is shut down, so publishers can no longer be used —
but direct device I/O (Modbus, serial) still works. Send the stop from `main()` after
`spin()` returns:

```cpp
int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  auto node = std::make_shared<MyBridgeNode>();
  rclcpp::spin(node);       // returns on SIGINT/SIGTERM
  // ROS context is already shut down here: no publishing, but device I/O works.
  // If device I/O runs in its own thread, stop/join that thread FIRST — otherwise it can
  // write the last setpoint again right after the stop below.
  node->stop_device();      // protocol-specific stop + read-back, bounded timeout
  rclcpp::shutdown();
  return 0;
}
```

Also call the same stop in `on_deactivate` for lifecycle nodes. A destructor is not a
safety mechanism — it does not run on a crash or `SIGKILL`.

### What "stop" must do

1. Send a protocol-specific safe command (zero speed, servo off, or the PLC's stop
   bit — addresses and values from the project's `CLAUDE.md`/datasheet, never guessed).
2. If the device can confirm, read the state back within a bounded timeout. A fixed
   sleep is not a confirmation.
3. If confirmation fails, log it as an error and rely on the device's own
   communication timeout / independent stop path; do not report that the actuator
   stopped.
4. Close the connection only after that.

```cpp
// Protocol-specific sketch — not a drop-in implementation
bool MyBridgeNode::stop_device()
{
  if (!link_.is_open()) { return false; }
  const bool confirmed = send_stop_and_confirm(link_, std::chrono::milliseconds(200));
  if (!confirmed) {
    RCLCPP_ERROR(get_logger(), "Stop not confirmed by device — relying on device comm timeout");
  }
  link_.close();
  return confirmed;
}
```

**Anti-pattern:** shutting down without a safe command. If the last write was
"speed = 1.0", the motor may keep running until the drive's own timeout fires — or
indefinitely if the drive has none.

### Make the launch stop as a unit

If the driver node exits, the rest of the stack should not keep running against it.
Humble launch supports `OnProcessExit` + `Shutdown`:

```python
from launch import LaunchDescription
from launch.actions import RegisterEventHandler, Shutdown
from launch.event_handlers import OnProcessExit
from launch_ros.actions import Node


def generate_launch_description():
    bridge = Node(package='my_robot_bridge', executable='bridge_node',
                  name='my_bridge', output='screen')
    return LaunchDescription([
        bridge,
        # ... other nodes ...
        RegisterEventHandler(OnProcessExit(
            target_action=bridge,
            on_exit=[Shutdown(reason='bridge exited')])),
    ])
```

Launch then exits, and systemd/pm2 decide whether to restart (§5).

## 10. Common failures and fixes

| Symptom | Cause | Fix |
|---|---|---|
| Unit stuck in "activating", then fails with timeout | `Type=notify` but `READY=1` comes from a child and `NotifyAccess` is `main` | `NotifyAccess=all` (§5 Option B), or use `Type=simple` |
| Service killed every `WatchdogSec` | Pings not reaching systemd, or node used `sd_watchdog_enabled()` (returns 0 in a child) | `NotifyAccess=all`; read `WATCHDOG_USEC` directly; ping at half the timeout |
| Watchdog never fires although a node hung | A different node is pinging | Exactly one node sends `WATCHDOG=1`, from its work loop |
| Service fails to start: package not found | ROS environment not sourced | Source `/opt/ros/humble/setup.bash` and the workspace in the wrapper script |
| Nodes run but `ros2 topic list` shows nothing | Shell and service use different `ROS_LOCALHOST_ONLY`/`ROS_DOMAIN_ID`, or stale daemon | Same values everywhere; `ros2 daemon stop` |
| `ROS_AUTOMATIC_DISCOVERY_RANGE` set but ROS still on LAN | Variable does not exist on Humble | Use `ROS_LOCALHOST_ONLY=1` |
| Motor keeps running after `pm2 restart` | `SIGKILL` after 1.6 s default, before stop was sent | Raise `kill_timeout`; stop device after `spin()` returns (§9) |
| Motor keeps running after node crash | No device-side communication timeout | Configure the drive/PLC timeout (skill `modbus`); a crash runs no cleanup |
| Copied `install/` fails on the mini PC | Built with `--symlink-install`, or different path/Ubuntu/ROS version | Build without symlinks, same path, same Ubuntu 22.04 + Humble (§1) |
| Update broke the machine, no way back | Release overwritten in place | Versioned release dirs + symlink switch (§4) |
| Driver crash-loops, hammering the device | Unattended restart | Keep auto-restart off for hardware drivers; `OnFailure=` alert + human restart. `StartLimitBurst` / `max_restarts` only catch fast crash loops (§5 notes) |
