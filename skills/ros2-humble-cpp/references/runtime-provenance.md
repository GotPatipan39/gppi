# Runtime Provenance and Overlay Auditing

Adapted from ros2-engineering-skills (Apache-2.0) @ 4ee4dea for ROS 2 Humble — see ../CHANGELOG.md

A build that succeeds, a launch file that parses, and a test suite that passes all
describe **source code**. This file is about the other question: *what is actually
running right now, and where did it come from?* Those two answers diverge constantly —
an old `install/` prefix, a second overlay on `AMENT_PREFIX_PATH`, a launch-time
parameter override, a second copy of a node nobody remembers starting (a manual
`ros2 run` next to the systemd/pm2 service).

Everything in §1–§9 is **read-only**: it observes a live system and does not move the
machine. Where a fix means stopping, killing or restarting a process, that step can
change what the machine does — Claude must ask the user first, and on a real machine
only with explicit instruction. When reporting results, state the test level as in
`SKILL.md` (build / unit test / simulator / hardware without load / real use); these
checks never prove motion behavior.

## Table of contents

1. [What the current shell resolves](#1-what-the-current-shell-resolves)
2. [What the running process actually inherited](#2-what-the-running-process-actually-inherited)
3. [Comparing the two](#3-comparing-the-two)
4. [Source tree vs installed copy](#4-source-tree-vs-installed-copy)
5. [Which parameters are actually in effect?](#5-which-parameters-are-actually-in-effect)
6. [Who actually publishes this topic?](#6-who-actually-publishes-this-topic)
7. [TF provenance: authority, duplicates, freshness](#7-tf-provenance-authority-duplicates-freshness)
8. [Stale daemon vs real processes](#8-stale-daemon-vs-real-processes)
9. [Provenance checklist](#9-provenance-checklist)
10. [Common failures and fixes](#10-common-failures-and-fixes)

---

## 1. What the current shell resolves

These commands answer how **the environment you are typing in** resolves a package.
That is useful — it is just not, on its own, an answer about any running node.

```bash
ros2 pkg prefix my_robot_bringup           # install prefix THIS shell resolves
ros2 pkg prefix --share my_robot_bringup   # its share/ directory (config, launch, urdf)
ros2 pkg executables my_robot_bridge       # executables this shell would run
echo "$AMENT_PREFIX_PATH" | tr ':' '\n'    # this shell's overlay order
```

**Proves:** how this shell's `AMENT_PREFIX_PATH` resolves the package right now — which
is what a command you launch *from here* will get.

**Does not prove:**

- that an already-running process was started from this environment;
- anything about a process started by a systemd unit, pm2, another terminal or SSH
  session, or a launch file that modified the environment.

## 2. What the running process actually inherited

For a claim about a running node, read that process:

```bash
# '[m]y_bridge' matches the process but not this shell: a plain `pgrep -f my_bridge`
# run through `bash -c` or ssh can return the wrapper's own PID, so a stopped stack
# looks alive.
pids=$(pgrep -f '[m]y_bridge_node')   # all of them — two PIDs = two masters (§8)
[ -n "$pids" ] || echo "not running"
[ "$(echo "$pids" | wc -w)" -le 1 ] || echo "WARNING: more than one instance: $pids"
pid=$(echo "$pids" | head -1)

tr '\0' ' ' < /proc/$pid/cmdline; echo   # how it was invoked (args, remaps, --params-file)
readlink /proc/$pid/exe                  # the executing binary (install/ path of the C++ node)
readlink /proc/$pid/cwd                  # working directory — relative paths resolve here
tr '\0' '\n' < /proc/$pid/environ |
  grep -E 'AMENT_PREFIX_PATH|COLCON_PREFIX_PATH|LD_LIBRARY_PATH|ROS_DISTRO|ROS_DOMAIN_ID|ROS_LOCALHOST_ONLY|RMW_IMPLEMENTATION|CYCLONEDDS_URI|FASTRTPS_DEFAULT_PROFILES_FILE'

ls -l /proc/$pid/fd | grep -v socket     # config/log/device files it holds open (e.g. /dev/ttyUSB*)
```

`AMENT_PREFIX_PATH` is the resolution order: the **first** prefix containing a package
wins, so a forgotten workspace early in that list shadows the one you are editing.

`ls -l /proc/$pid/fd` is also how to see **which process holds a serial port** before
anyone opens it — on RS-485 a second master collides with the one already polling the
bus. Opening a port that is in use requires asking the user first.

Limits to state alongside any finding from this section:

- **C++ nodes:** `exe` is the real binary, and `ldd`/`/proc/$pid/maps` show which
  shared libraries (and from which `install/` prefix) were loaded. For a component
  container, `exe` is `component_container` — the loaded plugin libraries appear in
  `/proc/$pid/maps`, not in `exe`.
- **Python launch files / Python nodes:** `exe` is `/usr/bin/python3`, which says
  nothing about which script ran; use `cmdline` and the environment.
- **Open files are supporting evidence, not an inventory.** A config file read once at
  startup is usually closed again; absence of an fd proves nothing.
- **`/proc` inspection needs permission** — normally the same user (e.g. the service's
  `User=`), or `sudo`.
- **Node names and PIDs are not 1:1.** One component container hosts many nodes; a node
  name may also be duplicated across processes (§8).
- **Containers:** PIDs are namespace-scoped; run the check inside the same container.

## 3. Comparing the two

The finding is the **difference** between §1 and §2. Resolve the same package in both,
and treat any divergence as the explanation for "my change had no effect":

```bash
# What this shell would use
ros2 pkg prefix --share my_robot_bringup

# What the running process can see, in its own order
tr '\0' '\n' < /proc/$pid/environ | grep '^AMENT_PREFIX_PATH='
```

If the prefix you inspected is not the first entry in the *process's* path that contains
the package, you have been reading a different copy of every launch file, YAML and
plugin XML than the one that ran. On the mini PC, the usual case is a service sourcing
`/opt/robot/ws/install` while you rebuilt `~/robot_ws` (or the reverse).

## 4. Source tree vs installed copy

Nodes read from the **install space**, not from `src/`. Diff them explicitly rather than
assuming a rebuild happened:

```bash
share=$(ros2 pkg prefix --share my_robot_bringup)
diff -u src/my_robot_bringup/config/params.yaml "$share/config/params.yaml"
diff -ru src/my_robot_bringup/launch "$share/launch"
```

`colcon build --symlink-install` reduces but does not remove this gap:

- Launch and data files installed through the symlink path point back at the source —
  editing the source changes what runs.
- C++ code always needs a rebuild (and a process restart) to change behavior.
- Files added *after* the last build are missing from the install space entirely,
  symlinks or not.
- A package built once **without** `--symlink-install` leaves real copies behind; a
  later symlink build does not necessarily clean them up. When in doubt,
  `ls -l "$share/config/"` and look for symlink arrows.

**Stale-overlay smell test.** colcon does not remove install artifacts of deleted
sources:

```bash
# Any installed launch file whose source counterpart is gone
for f in "$share"/launch/*; do
  [ -e "src/my_robot_bringup/launch/$(basename "$f")" ] || echo "orphaned: $f"
done
```

The fix is to delete `build/<pkg>`, `install/<pkg>` (and `log/`) for that package and
rebuild — **this is not read-only**: on the mini PC it changes the install a running
service sources. Ask the user first, and do it in a new release dir (`deployment.md` §4)
rather than in place. Overlay mechanics at build time: `workspace-build.md` §6.

**Deployment chronology.** A commit, a build artifact, a deployment event, and the bytes
now installed on the mini PC are four different claims. A hash or "deployed" line in an
earlier report describes that earlier moment, not the current installation. A commit
that changed only tests does not establish that node or config bytes changed. After any
deployment, re-read the installed files on the target and record their current hashes:

```bash
# On the target — what is installed right now
find /opt/robot/ws/install/my_robot_bridge -type f \( -perm -u+x -o -name '*.yaml' -o -name '*.so' \) \
  -exec sha256sum {} + | sort -k2
```

**Copying a symlinked install tree.** `cp -r` copies symbolic links as links, so a
"copy" of an install space built with `--symlink-install` still points at the
sources (and dangles on another machine — see `deployment.md` §1). Before copying,
resolve every link and refuse the copy if any link leaves the tree or does not resolve.
Compare whole path components: a prefix test such as `grep -v " -> $share"` accepts
`/opt/share-outside/key` as inside `/opt/share`. Then copy with `-L` and check that no
link survived:

```bash
# copy_tree_self_contained <tree> <dest>: copies nothing when a link leaves
# <tree> or dangles. A link cycle makes cp itself fail.
copy_tree_self_contained() {
  root=$(readlink -f -- "$1") && [ -d "$root" ] || { echo "not a directory: $1"; return 1; }
  [ ! -e "$2" ] || { echo "destination exists: $2"; return 1; }
  escaping=$(find "$root" -type l -exec sh -c '
    root=$1; shift
    for link; do
      target=$(readlink -f -- "$link") && [ -e "$target" ] || { printf "%s -> (unresolved)\n" "$link"; continue; }
      case $target in "$root"|"$root"/*) ;; *) printf "%s -> %s\n" "$link" "$target" ;; esac
    done' sh "$root" {} +) || { echo "cannot list links under $root"; return 1; }
  if [ -n "$escaping" ]; then
    printf '%s\n' "$escaping"
    echo "links leave the tree or dangle: copy the needed files explicitly"
    return 1
  fi
  cp -rL -- "$root" "$2" || return 1
  if [ -n "$(find "$2" -type l)" ]; then echo "symlinks remain in $2"; return 1; fi
}
copy_tree_self_contained "$share" /tmp/share_copy
```

## 5. Which parameters are actually in effect?

A YAML file on disk is a proposal. The parameter server holds the outcome, after
launch-time overrides, node-name mismatches (a YAML block keyed to a node name that does
not match the running node is silently ignored), and `set_parameter` calls at runtime.

```bash
ros2 param dump /my_bridge                   # everything the node currently holds (Humble prints YAML to stdout)
ros2 param get /my_bridge cmd_timeout        # one value
ros2 param describe /my_bridge cmd_timeout   # type, range, description
```

Dump the live values into a file and diff them against the YAML you believe was loaded:

```bash
ros2 param dump /my_bridge > /tmp/live_params.yaml
diff -u "$share/config/params.yaml" /tmp/live_params.yaml   # structure may differ; compare values
```

Parameters showing their default values when your YAML sets something else mean the
file did not reach the node — wrong node-name key, wrong namespace, `--params-file` not
passed, or a later `-p` override.

`ros2 param set` on a driver is **not** read-only: changing a limit, scale or timeout on
a running hardware node changes what the machine does. Ask the user first.

## 6. Who actually publishes this topic?

`ros2 topic echo` shows *a* message. It never shows who sent it, and it cannot show that
two nodes are alternating writes on the same topic — exactly the failure behind "the
stop command worked, then the machine kept moving."

```bash
ros2 topic info /cmd_vel -v      # per-endpoint node name, namespace, type, GID, QoS
```

Read the **Publisher count** first. On any command topic the answer must match what the
architecture allows — normally one arbiter (`safety-estop.md` §3). With two compatible
publishers, the subscriber receives both; DDS has no command priority, so which one
reaches the actuator depends on timing.

```bash
ros2 node info /my_bridge        # the other direction: what this node pubs/subs
```

Caveats:

- Endpoint node names come from discovery data. A killed node can linger briefly; a
  node that never spun may not appear.
- Nodes in different namespaces publishing "the same" relative topic resolve to
  different absolute topics — check the namespace, not just the name.
- QoS is reported per endpoint, so this same command answers "why does nobody receive
  it" (`communication.md`).

## 7. TF provenance: authority, duplicates, freshness

A `lookupTransform` that succeeds proves the chain **connects**. It does not prove the
transform is fresh, nor that one node owns that edge.

**Authority cannot be recovered from the TF buffer in ROS 2.** ROS 1 attributed each
transform to its publisher via the connection header; ROS 2 has no such header, so
Humble's `tf2_ros::TransformListener` stores the literal string
`"Authority undetectable"` for every transform
([transform_listener.cpp, humble](https://github.com/ros2/geometry2/blob/humble/tf2_ros/src/transform_listener.cpp)).
Anything built on that field — `tf2_monitor`'s broadcaster column, the `Broadcaster:`
line in `view_frames` output — inherits the placeholder.

Start from the topic's endpoints instead:

```bash
ros2 topic info /tf -v
ros2 topic info /tf_static -v
```

This lists the live `/tf` publishers. It does not attribute each parent→child edge to a
publisher: one publisher can carry many transforms in a single `TFMessage`. For per-edge
attribution you additionally need one of:

- narrowing the candidates from the launch files and process list;
- process logs, or a broadcaster that logs what it publishes;
- stopping candidate publishers one at a time and watching which edge disappears —
  **stopping a node can change machine behavior; ask the user first, and never on a
  running machine without explicit instruction.**

Then check what a successful lookup does not cover:

```bash
ros2 run tf2_ros tf2_monitor                    # rate and delay for all frames
ros2 run tf2_ros tf2_monitor odom base_link     # one chain only
ros2 run tf2_ros tf2_echo odom base_link        # the transform now, with its timestamp
```

- **Duplicate edges.** Two broadcasters publishing the same parent→child pair both
  insert into that edge's history; a lookup returns whatever the interleaved history
  yields. tf2 logs `TF_REPEATED_DATA ignoring data with redundant timestamp` when the
  *same* stamp arrives twice — a **clue, not proof** (one publisher resending a stamp, or
  a bag played next to the live publisher, produces it too), and it is *absent* when the
  two broadcasters use different stamps, which is the worse case. Confirm structurally:
  every edge has exactly one owner, written down. `robot_state_publisher` plus an
  odometry node both publishing `odom→base_link` or a joint-derived edge is the classic
  collision (`tf2-urdf.md`).
- **Freshness.** `tf2_monitor`'s average/max delay is the number to watch. A chain that
  stopped updating still resolves while the buffer's cache holds data (10 s by default),
  so a stale pose looks like a working one until lookups start failing.
- **Time source.** If some nodes run `use_sim_time: true` and others do not, timestamps
  come from two clocks and extrapolation errors name a frame that is not the real
  problem (`tf2-urdf.md`).

## 8. Stale daemon vs real processes

`ros2 node list` and friends answer from the CLI daemon's cached graph. The cache can
outlive the nodes, and it keeps the `ROS_DOMAIN_ID` / `ROS_LOCALHOST_ONLY` /
`RMW_IMPLEMENTATION` in effect when the daemon started (`deployment.md` §6).

```bash
ros2 node list --no-daemon        # bypass the cache, discover directly (slower)
ros2 daemon stop                  # next CLI call starts a fresh daemon
ros2 daemon status
```

A shell with different `ROS_LOCALHOST_ONLY`/`ROS_DOMAIN_ID` than the service sees an
empty graph while the machine runs normally — compare with the service's environment
from `/proc/$pid/environ` (§2).

Then confirm against the operating system, which does not cache:

```bash
pgrep -af '[r]os2|[m]y_bridge_node|[r]obot_state_publisher'   # bracket: never match this shell
ps -eo pid,ppid,etime,user,cmd | grep -i '[m]y_robot'
systemctl status ros2-base.service      # if started by systemd (read-only)
pm2 status                              # if started by pm2 (read-only)
```

**ROS 2 permits duplicate node names.** Two processes with the same node name both join
the graph; the CLI may show the name once or warn about duplicates, while both are
publishing. A leftover process from a previous run — a launch that was Ctrl-C'd but left
an orphan, a manual `ros2 run` started while the service was also running — presents as
one node and behaves as two publishers. The process list is the authoritative answer,
and `ros2 topic info -v` on its output topic confirms the duplication. On hardware this
also means **two masters on one device or RS-485 bus**.

## 9. Provenance checklist

Work through this before concluding that a change had any effect. Each row lists what
the answer does **not** prove, because that is where wrong conclusions come from.

| # | Question | Command | Does not prove |
|---|---|---|---|
| 1 | How does *this shell* resolve the package? | `ros2 pkg prefix [--share]` | anything about an already-running process (§1) |
| 2 | How was the process invoked? | `tr '\0' ' ' < /proc/$pid/cmdline` | which config the node actually read |
| 3 | Which binary is executing? | `readlink /proc/$pid/exe` | which plugin libraries a container loaded (use `/proc/$pid/maps`) |
| 4 | Which prefixes can it see, in what order? | `AMENT_PREFIX_PATH` from `/proc/$pid/environ` | which prefix a given package resolved to |
| 5 | Where did its config come from? | `ros2 pkg prefix --share`, then `diff` vs source | that the node read that file |
| 6 | Which parameters are in effect? | `ros2 param dump` | that they were applied to the running behavior |
| 7 | Who publishes the command topic? | `ros2 topic info <topic> -v` | that no other node will start publishing later |
| 8 | Which endpoints publish `/tf`? | `ros2 topic info /tf -v` + written ownership map | which endpoint sent a *specific* edge (§7), or that it is fresh |
| 9 | Is the graph view current? | `--no-daemon`, `ros2 daemon stop` | that only one process backs each node name |
| 10 | Which processes are really alive? | `pgrep -af`, `systemctl status`, `pm2 status` | that they are all the ones you meant to start |
| 11 | What is installed on the target right now? | `sha256sum` on the target's install space (§4) | that the last report or commit describes it |

Limits that apply to the whole checklist:

- **Node names and OS PIDs are not 1:1** (component containers, duplicate names).
- **`/proc` is Linux-only, PID-namespace-scoped, and needs permission.**
- **Point-in-time observations miss intermittent faults.** Publisher contention that
  appears for 200 ms during a reconnect will not show in one `ros2 topic info -v`.
  Sample repeatedly or record (`system-diagnostics.md` §2).

This checklist reaches at most "hardware without load" level and only observes — it
never shows how the machine moves.

## 10. Common failures and fixes

| Symptom | Why it happens | Fix |
|---|---|---|
| Config edit has no effect | Node loaded the installed copy, not `src/` | `diff` source against `ros2 pkg prefix --share`; rebuild, then restart the node (ask first) |
| Rebuilt, still the old behavior | Another overlay earlier in `AMENT_PREFIX_PATH`, or the service sources a different workspace | Read `AMENT_PREFIX_PATH` from `/proc/<pid>/environ`; fix the service's source order |
| Rebuilt C++, still the old behavior | The running process was started before the build | Check process start time (`ps -o etime`) vs build time; restart (ask first) |
| Deleted file still loads | `install/` keeps artifacts of removed sources | Delete `build/`, `install/` for that package and rebuild |
| YAML values ignored, defaults in force | Node-name key or namespace in the YAML does not match | Compare `ros2 param dump` with the file; fix the key or `--params-file` |
| Stop command "sent" but machine moves | A second publisher on the command topic | `ros2 topic info <topic> -v`; single arbiter (`safety-estop.md` §3) |
| Pose looks right, behavior wrong | TF edge from two broadcasters, or stale within the cache window | Map edge ownership; check `tf2_monitor` delay |
| `view_frames` broadcaster says nothing useful | ROS 2 stores `"Authority undetectable"` | Use `ros2 topic info /tf -v` |
| Node listed but nothing responds | Stale daemon cache, or shell env differs from the service | `--no-daemon`; `ros2 daemon stop`; compare env with `/proc/$pid/environ` |
| Two behaviors from "one" node / Modbus errors appear | Duplicate process (orphan or manual run next to the service) — two masters on one bus | `pgrep -af` vs the expected list; ask the user before killing anything |

---

**See also:** `debugging.md` for the introspection CLI and DDS-level diagnosis,
`workspace-build.md` §6 for overlay mechanics, `deployment.md` for release layout and
service environment, `system-diagnostics.md` for faults that originate outside the ROS
graph, `safety-estop.md` §3 for command-topic ownership.
