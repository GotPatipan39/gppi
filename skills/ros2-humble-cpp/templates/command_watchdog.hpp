// Template: watchdog ของคำสั่ง — logic ล้วน ไม่ include rclcpp จึงเขียน gtest ได้
// ใช้ std::chrono::steady_clock เสมอ ไม่ใช้ node->now() (ROS time):
//   ROS time หยุดเดินเมื่อ use_sim_time:=true แต่ไม่มีใคร publish /clock (เช่นตั้งผิดบนเครื่องจริง)
//   watchdog ที่ใช้ ROS time จะไม่มีวันหมดเวลา = เครื่องทำคำสั่งสุดท้ายค้างไว้
#pragma once

#include <chrono>

class CommandWatchdog
{
public:
  using Clock = std::chrono::steady_clock;

  explicit CommandWatchdog(double timeout_s)
  : timeout_(std::chrono::duration_cast<Clock::duration>(std::chrono::duration<double>(timeout_s))) {}

  // เรียกทุกครั้งที่ได้คำสั่งที่ถูกต้อง
  void feed(Clock::time_point now) {last_ = now; fed_ = true;}

  // ยังไม่เคยได้คำสั่ง = หมดเวลาแล้ว (เริ่มต้นที่ "หยุด")
  bool expired(Clock::time_point now) const {return !fed_ || now - last_ > timeout_;}

private:
  Clock::duration timeout_;
  Clock::time_point last_{};
  bool fed_{false};
};
