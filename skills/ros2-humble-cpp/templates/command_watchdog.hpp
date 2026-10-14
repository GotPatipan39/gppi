// Template: watchdog ของคำสั่ง — logic ล้วน ไม่ include rclcpp จึงเขียน gtest ได้
// ใช้ std::chrono::steady_clock เสมอ ไม่ใช้ node->now() (ROS time):
//   ROS time หยุดเดินเมื่อ use_sim_time:=true แต่ไม่มีใคร publish /clock (เช่นตั้งผิดบนเครื่องจริง)
//   watchdog ที่ใช้ ROS time จะไม่มีวันหมดเวลา = เครื่องทำคำสั่งสุดท้ายค้างไว้
#pragma once

#include <chrono>
#include <cmath>
#include <stdexcept>

class CommandWatchdog
{
public:
  using Clock = std::chrono::steady_clock;

  // timeout_s: หมดเวลาถ้าไม่ได้คำสั่งนานเกินนี้
  // check_period_s: รอบที่โค้ดเรียก expired() (รอบ timer) — timeout ต้องยาวอย่างน้อย 3 รอบ
  //   ไม่งั้น watchdog ถูกตรวจห่างกว่า timeout (เช่น rate 0.5 Hz = ตรวจทุก 2 s ทั้งที่ timeout 0.5 s)
  // ค่าผิด → throw: NaN/Inf, ≤ 0, ใหญ่จนแปลงเป็น duration ไม่ได้ (overflow = UB)
  // ไม่มีเพดานของงานที่นี่ — timeout ที่เหมาะกับเครื่องมาจากโปรเจกต์ (CLAUDE.md/datasheet)
  CommandWatchdog(double timeout_s, double check_period_s)
  : timeout_(to_duration(timeout_s))
  {
    // เผื่อ rounding ของ double ที่ขอบพอดี (3 × 0.05 = 0.15000000000000002) — ต่างกันระดับ 1e-9 ไม่มีผลกับเครื่อง
    if (!std::isfinite(check_period_s) || check_period_s <= 0.0 ||
      timeout_s < 3.0 * check_period_s * (1.0 - 1e-9))
    {
      throw std::invalid_argument("CommandWatchdog: timeout must be at least 3 check periods");
    }
  }

  // เรียกทุกครั้งที่ได้คำสั่งที่ถูกต้อง
  void feed(Clock::time_point now) {last_ = now; fed_ = true;}

  // ยังไม่เคยได้คำสั่ง = หมดเวลาแล้ว (เริ่มต้นที่ "หยุด")
  bool expired(Clock::time_point now) const {return !fed_ || now - last_ > timeout_;}

private:
  static Clock::duration to_duration(double s)
  {
    // ขอบบนที่แปลงได้: ช่วงของ Clock::duration (int64 ns ≈ 292 ปี) — หารครึ่งเผื่อการบวกกับ time_point
    const double max_s =
      std::chrono::duration<double>(Clock::duration::max()).count() / 2.0;
    if (!std::isfinite(s) || s <= 0.0 || s > max_s) {
      throw std::invalid_argument("CommandWatchdog: timeout must be finite, > 0 and representable");
    }
    return std::chrono::duration_cast<Clock::duration>(std::chrono::duration<double>(s));
  }

  Clock::duration timeout_;
  Clock::time_point last_{};
  bool fed_{false};
};
