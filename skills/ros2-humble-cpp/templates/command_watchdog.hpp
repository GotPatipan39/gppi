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

  // timeout ที่ไม่ใช่ตัวเลขจริงหรือ ≤ 0 → throw: Inf/ค่าใหญ่ = ไม่มีวันตัด, NaN แปลงเป็น duration เป็น UB
  explicit CommandWatchdog(double timeout_s)
  : timeout_(to_duration(timeout_s)) {}

  // เรียกทุกครั้งที่ได้คำสั่งที่ถูกต้อง
  void feed(Clock::time_point now) {last_ = now; fed_ = true;}

  // ยังไม่เคยได้คำสั่ง = หมดเวลาแล้ว (เริ่มต้นที่ "หยุด")
  bool expired(Clock::time_point now) const {return !fed_ || now - last_ > timeout_;}

private:
  static Clock::duration to_duration(double s)
  {
    if (!std::isfinite(s) || s <= 0.0) {
      throw std::invalid_argument("CommandWatchdog: timeout must be finite and > 0");
    }
    return std::chrono::duration_cast<Clock::duration>(std::chrono::duration<double>(s));
  }

  Clock::duration timeout_;
  Clock::time_point last_{};
  bool fed_{false};
};
