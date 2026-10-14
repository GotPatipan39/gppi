# Wheel odometry (differential drive) on Humble

Written for this skill (not from upstream). The code below is plain C++17 with no
rclcpp, so it can be unit tested without hardware (skill `tdd`). Wheel radius, wheel
separation, encoder ticks per revolution, the counter width and the maximum wheel speed
come from the project's `CLAUDE.md` or the drive/motor/encoder datasheet — **never
guessed**: a wrong value produces odometry that looks plausible and drifts silently.

**Ticks per revolution is the number the drive actually counts.** Datasheets give PPR
(lines) or CPR; a quadrature input counted on all edges reports 4 × PPR. Using PPR where
the drive counts ×4 makes every distance 4 times too large; forgetting the gearbox ratio
makes it off by that ratio. Confirm on the machine (section 6) before trusting it.

## Table of contents

1. [Use diff_drive_controller when you have ros2_control](#1-use-diff_drive_controller-when-you-have-ros2_control)
2. [Integrating encoder counts](#2-integrating-encoder-counts)
3. [Counter wraparound, resets and implausible steps](#3-counter-wraparound-resets-and-implausible-steps)
4. [Publishing nav_msgs/Odometry and TF](#4-publishing-nav_msgsodometry-and-tf)
5. [Tests](#5-tests)
6. [Calibration](#6-calibration)
7. [Common failures and fixes](#7-common-failures-and-fixes)

---

## 1. Use diff_drive_controller when you have ros2_control

If the base already runs through ros2_control, `diff_drive_controller` computes and
publishes odometry — do not write a second odometry node (two publishers of
`odom → base_link` make TF jump; `runtime-provenance.md` §7). Relevant Humble
parameters (from `diff_drive_controller_parameter.yaml` on the `humble` branch of
ros2_controllers): `wheel_separation`, `wheel_radius`, `wheel_separation_multiplier`,
`left_wheel_radius_multiplier` / `right_wheel_radius_multiplier`, `odom_frame_id`,
`base_frame_id`, `enable_odom_tf`, `position_feedback`, `open_loop`,
`pose_covariance_diagonal`, `twist_covariance_diagonal`. Check the installed version with
`ros2 param list /<controller_name>` before relying on a name, and see the
`use_stamped_vel` trap in `hardware-interface.md`.

Write your own (below) when the base is driven by a bridge node that talks to a PLC or
drive over Modbus and reads encoder counts directly.

## 2. Integrating encoder counts

```cpp
// diff_drive_odometry.hpp — logic only, no rclcpp
#pragma once
#include <cmath>
#include <cstdint>
#include <stdexcept>

struct DiffDriveGeometry {
  double wheel_radius_m;      // from CLAUDE.md / measured (section 6)
  double wheel_separation_m;  // between the wheels' contact centres
  double ticks_per_rev;       // encoder ticks per WHEEL revolution, gearbox included
};

struct Pose2D  { double x = 0.0, y = 0.0, theta = 0.0; };
struct Twist2D { double v = 0.0, w = 0.0; };  // m/s, rad/s in base_link

// Signed change of a free-running unsigned 32-bit counter, correct across
// wraparound as long as the wheel moves less than half the counter range per sample.
inline int64_t counter_delta_u32(uint32_t now, uint32_t prev) {
  return static_cast<int32_t>(now - prev);  // modular subtraction, then signed view
}
// 16-bit counters (common in PLC/drive registers) wrap far sooner — check the rate
inline int64_t counter_delta_u16(uint16_t now, uint16_t prev) {
  return static_cast<int16_t>(static_cast<uint16_t>(now - prev));
}

class DiffDriveOdometry {
 public:
  // max_wheel_speed_mps: fastest a wheel can physically move (motor max rpm and
  // gearbox from the datasheet / CLAUDE.md) plus a margin — never guessed.
  // Too low throws away real motion (section 3); too high lets counter resets through.
  // A step faster than this is a bad reading, not motion.
  DiffDriveOdometry(DiffDriveGeometry g, double max_wheel_speed_mps)
  : g_(g), max_wheel_speed_(max_wheel_speed_mps) {
    if (!(pos(g.wheel_radius_m) && pos(g.wheel_separation_m) &&
          pos(g.ticks_per_rev) && pos(max_wheel_speed_mps))) {
      throw std::invalid_argument("odometry geometry must be finite and > 0");
    }
  }

  // Returns false and leaves pose/twist unchanged when the step is rejected.
  // A rejected cycle has no new data: do not publish odometry/TF for it (section 3).
  bool update(int64_t d_ticks_left, int64_t d_ticks_right, double dt_s) {
    if (!pos(dt_s)) return reject();
    const double per_tick = 2.0 * M_PI * g_.wheel_radius_m / g_.ticks_per_rev;
    const double dl = d_ticks_left * per_tick;
    const double dr = d_ticks_right * per_tick;
    const double max_step = max_wheel_speed_ * dt_s;
    if (std::abs(dl) > max_step || std::abs(dr) > max_step) return reject();
    consecutive_rejects_ = 0;

    const double ds = 0.5 * (dr + dl);
    const double dth = (dr - dl) / g_.wheel_separation_m;
    // Midpoint heading: exact for straight lines and pure rotation, small error on arcs
    pose_.x += ds * std::cos(pose_.theta + 0.5 * dth);
    pose_.y += ds * std::sin(pose_.theta + 0.5 * dth);
    pose_.theta = std::atan2(std::sin(pose_.theta + dth), std::cos(pose_.theta + dth));
    twist_.v = ds / dt_s;
    twist_.w = dth / dt_s;
    return true;
  }

  const Pose2D & pose() const { return pose_; }
  const Twist2D & twist() const { return twist_; }
  // Rejected steps in a row; the bridge treats a run of them as lost odometry
  int consecutive_rejects() const { return consecutive_rejects_; }

 private:
  static bool pos(double v) { return std::isfinite(v) && v > 0.0; }
  bool reject() { ++consecutive_rejects_; return false; }
  DiffDriveGeometry g_;
  double max_wheel_speed_;
  Pose2D pose_;
  Twist2D twist_;
  int consecutive_rejects_ = 0;
};
```

- Sign convention (REP-103): forward is +x, counter-clockwise is +theta. If one motor is
  mounted mirrored, its count goes down when driving forward — negate that side's delta
  in the bridge, once, with a comment saying which side and why.
- `dt_s` is the time between the two **encoder samples**, measured with a steady clock
  in the bridge, not the timer period: a late timer callback still covers the real
  elapsed time. It includes the Modbus round-trip jitter, which is one more reason
  `max_wheel_speed` needs a margin.
- **Read both wheels in one request.** Left and right counters read in separate Modbus
  requests come from different instants, which shows up as heading error while
  accelerating. A 32-bit counter read as two separate 16-bit reads can tear (the low
  word wraps between the reads) and produce a jump of 65536 ticks. Read every counter
  register in a single request, and take the word order from the device datasheet
  (skill `modbus`).

## 3. Counter wraparound, resets and implausible steps

The bridge keeps the previous raw count per wheel. Three cases break naive subtraction:

| Case | What happens | Handling |
|---|---|---|
| Counter wraps (65535 → 0) | `now - prev` as plain integers jumps by the whole range | `counter_delta_u16/u32` above |
| Drive power-cycled or counter reset | count restarts at 0 → one huge delta | `update` rejects it (faster than `max_wheel_speed`) |
| Read failed / link down | no sample, or the next sample spans a long gap | do not integrate across the gap |

On a rejected step or the first sample after a read failure: **re-base** (`prev = now`)
without integrating, do not publish odometry or TF for that cycle, log a warning, and
publish a diagnostic (`system-diagnostics.md` §3). The pose has lost that interval's
motion — that is an honest error which localization can correct, unlike a 3 km jump
that a reset would otherwise add. Keeping the old `prev` instead would reject every
following sample after a counter reset.

**A run of rejects means odometry is broken, not noisy.** Wrong word order, a
`max_wheel_speed` set below the real speed, or a wrong `ticks_per_rev` make *every*
step look implausible: the pose freezes while the robot drives. When
`consecutive_rejects()` reaches a limit (samples covering a fraction of a second — a
project value, ask the user), raise the diagnostic to ERROR and stop publishing
odometry and TF until steps are accepted again, exactly as when the link to the drive
is lost (section 4). Consumers then time out visibly instead of trusting a frozen pose.

**The plausibility check does not catch every reset.** After a reset the delta is
`new_count - old_count` modulo the counter width; with a 16-bit counter that is roughly
uniform over ±32768, and the share of it that falls within the accepted step is small
but not zero. If the drive exposes a power-up/reset flag or a counter-valid bit, check
that first and re-base on it; the speed check is the fallback.

## 4. Publishing nav_msgs/Odometry and TF

| Field | Value |
|---|---|
| `header.stamp` | time of the encoder sample (`now()` when it was read). ROS time is right for stamps; the command watchdog is the one that must use a steady clock |
| `header.frame_id` / `child_frame_id` | `odom` / `base_link` (parameters, `tf2-urdf.md` §1) |
| `pose.pose` | `x`, `y`, and `theta` as a yaw-only quaternion (`tf2::Quaternion::setRPY(0, 0, theta)`) |
| `twist.twist` | `linear.x = v`, `angular.z = w` — in `child_frame_id`, not `odom` |
| covariance | non-zero diagonal for x, y, yaw (and their velocities); large values for z, roll, pitch. All zeros tells `robot_localization` the data is perfect (`message-types.md`) |

Publish the `odom → base_link` TF from this node only behind a parameter
(`publish_tf`, default `true`). When an EKF (`robot_localization`) fuses wheel odometry
with an IMU, the EKF publishes that transform and this node must not — set
`publish_tf: false`.

Odometry stops when the bridge loses the drive, and when steps keep being rejected
(section 3). Do not keep publishing the last pose
with fresh stamps: consumers would treat a stale pose as current. Stop publishing (TF
consumers then time out visibly) and report it in `/diagnostics`.

## 5. Tests

Expected values come from geometry, not from the formula in the code (skill `tdd`):

```cpp
#include <gtest/gtest.h>
#include "my_pkg/diff_drive_odometry.hpp"

// r = 0.1 m, b = 0.5 m, 1000 ticks/rev — test values, not a real robot
const DiffDriveGeometry kGeo{0.1, 0.5, 1000.0};

TEST(Odometry, OneWheelTurnForwardIsOneCircumference) {
  DiffDriveOdometry odo(kGeo, 10.0);
  ASSERT_TRUE(odo.update(1000, 1000, 1.0));
  EXPECT_NEAR(odo.pose().x, 0.6283185307, 1e-9);  // 2 * pi * 0.1
  EXPECT_NEAR(odo.pose().y, 0.0, 1e-12);
  EXPECT_NEAR(odo.pose().theta, 0.0, 1e-12);
}

TEST(Odometry, OppositeQuarterTurnsRotateInPlace) {
  DiffDriveOdometry odo(kGeo, 10.0);
  // each wheel 0.05*pi m in opposite directions on a 0.5 m track = 0.2*pi rad
  ASSERT_TRUE(odo.update(-250, 250, 1.0));
  EXPECT_NEAR(odo.pose().theta, 0.6283185307, 1e-9);
  EXPECT_NEAR(odo.pose().x, 0.0, 1e-12);
  EXPECT_NEAR(odo.pose().y, 0.0, 1e-12);
}

TEST(Odometry, PivotAroundLeftWheelReturnsToStart) {
  // right wheel drives a full circle of radius b around the stopped left wheel
  DiffDriveOdometry odo(kGeo, 10.0);
  const int steps = 1000;
  const double right_ticks = 2 * M_PI * 0.5 / (2 * M_PI * 0.1) * 1000.0;  // 5000
  for (int i = 0; i < steps; ++i) {
    ASSERT_TRUE(odo.update(0, static_cast<int64_t>(right_ticks / steps), 0.01));
  }
  EXPECT_NEAR(odo.pose().x, 0.0, 1e-3);
  EXPECT_NEAR(odo.pose().y, 0.0, 1e-3);
  EXPECT_NEAR(odo.pose().theta, 0.0, 1e-3);
}

TEST(Odometry, QuarterArcEndsOnTheTrueArc) {
  // Pivot around the stopped left wheel: the base centre moves on a circle of
  // radius b/2 around it, so after 90 deg it is at (b/2, b/2) = (0.25, 0.25).
  // Right wheel travels b * pi/2 = 0.25*pi m = 1250 ticks, in 5 samples.
  // Catches heading integration without the midpoint (ends ~0.07 m away).
  DiffDriveOdometry odo(kGeo, 10.0);
  for (int i = 0; i < 5; ++i) {
    ASSERT_TRUE(odo.update(0, 250, 0.1));
  }
  EXPECT_NEAR(odo.pose().x, 0.25, 0.005);
  EXPECT_NEAR(odo.pose().y, 0.25, 0.005);
  EXPECT_NEAR(odo.pose().theta, M_PI / 2, 1e-9);
}

TEST(Odometry, CounterWrapIsSmallForwardStep) {
  EXPECT_EQ(counter_delta_u32(5u, 0xFFFFFFFBu), 10);
  EXPECT_EQ(counter_delta_u16(3u, 65533u), 6);
  EXPECT_EQ(counter_delta_u16(65533u, 3u), -6);
}

TEST(Odometry, CounterResetIsRejectedNotIntegrated) {
  DiffDriveOdometry odo(kGeo, 2.0);  // 2 m/s max wheel speed
  ASSERT_TRUE(odo.update(100, 100, 0.05));
  const Pose2D before = odo.pose();
  // drive power-cycled: counter went from ~3,000,000 to 0 within one 50 ms sample
  // each drive can reset on its own — check each side separately
  EXPECT_FALSE(odo.update(-3000000, 100, 0.05));
  EXPECT_FALSE(odo.update(100, -3000000, 0.05));
  EXPECT_DOUBLE_EQ(odo.pose().x, before.x);
  EXPECT_DOUBLE_EQ(odo.pose().y, before.y);
  EXPECT_DOUBLE_EQ(odo.pose().theta, before.theta);
}

TEST(Odometry, ConsecutiveRejectsAreCountedAndResetOnAccept) {
  // The bridge stops publishing after a run of rejects (section 3) — the count must
  // grow on every reject, including bad dt, and return to 0 on the next good step.
  DiffDriveOdometry odo(kGeo, 2.0);
  EXPECT_FALSE(odo.update(-3000000, 0, 0.05));
  EXPECT_FALSE(odo.update(0, 0, 0.0));
  EXPECT_FALSE(odo.update(0, -3000000, 0.05));
  EXPECT_EQ(odo.consecutive_rejects(), 3);
  ASSERT_TRUE(odo.update(10, 10, 0.05));
  EXPECT_EQ(odo.consecutive_rejects(), 0);
}

TEST(Odometry, BadDtIsRejected) {
  DiffDriveOdometry odo(kGeo, 2.0);
  EXPECT_FALSE(odo.update(10, 10, 0.0));
  EXPECT_FALSE(odo.update(10, 10, std::nan("")));
}

TEST(Odometry, BadGeometryThrows) {
  EXPECT_THROW(DiffDriveOdometry({0.0, 0.5, 1000.0}, 2.0), std::invalid_argument);
  EXPECT_THROW(DiffDriveOdometry({0.1, 0.5, 1000.0}, std::nan("")), std::invalid_argument);
}
```

These tests cover the arithmetic only. Whether the robot actually ends where the
odometry says is section 6, on the machine, run by the user.

## 6. Calibration

Nominal wheel radius and separation are rarely exact (tyre compression, contact patch
width). Calibrating moves the robot, so **the user runs it** (rules.md), on a clear
floor at low speed; Claude can prepare the procedure and compute the corrections from
the measurements the user reports.

1. **Radius** — drive straight a measured distance (e.g. 5 m tape). New radius =
   old radius × measured distance / odometry distance.
2. **Separation** — only after the new radius is in use (the odometry angle scales with
   radius / separation, so a rotation measured with the old radius gives a separation
   that is off by the radius correction): rotate in place a whole number of turns
   (e.g. 10), measure the real angle from a floor mark. New separation = old separation
   × odometry angle / real angle.

Repeat both in each direction; a large left/right difference points to unequal wheel
radii (`*_wheel_radius_multiplier` on `diff_drive_controller`, or two radii in your own
code). Record the result and how it was measured in the project's `CLAUDE.md`.

## 7. Common failures and fixes

| Symptom | Likely cause | Fix |
|---|---|---|
| Robot drives forward, odometry rotates | one side's encoder sign is reversed | negate that side once in the bridge (section 2) |
| Odometry jumps kilometres once | counter reset or wrap handled as plain subtraction | `counter_delta_*` + plausibility reject + re-base (section 3) |
| Distance right, heading drifts a lot when turning | wheel separation wrong | calibrate (section 6) |
| Distance consistently a few % off | wheel radius differs from nominal | calibrate (section 6) |
| Distance off by a large whole factor (×4, ×gear ratio) | `ticks_per_rev` uses PPR where the drive counts quadrature ×4, or excludes the gearbox | recompute from the datasheet (top of this file), then calibrate |
| Pose frozen while the robot drives, warnings about rejected steps | every step rejected: wrong word order, `max_wheel_speed` too low, wrong `ticks_per_rev` | fix the cause; the bridge must already have stopped publishing (section 3) |
| TF `odom → base_link` flickers between two values | EKF and odometry node both publish it | `publish_tf: false` on the odometry node |
| `robot_localization` ignores or over-trusts wheel odometry | zero or copied covariance | set a real diagonal (section 4) |
| Pose drifts while the robot stands still | encoder noise ±1 tick integrates | usually harmless; if not, deadband in the bridge — do not change `max_wheel_speed` |
| 16-bit counter wraps between samples at full speed | sample period too long for the counter width | poll faster or read the 32-bit register; check: ticks/s at max speed × period < 32768 |
