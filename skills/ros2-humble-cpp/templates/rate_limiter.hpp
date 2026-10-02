// Template: ตัวจำกัดอัตราเปลี่ยน (ramp) — logic ล้วน ไม่ include rclcpp จึงเขียน gtest ได้ง่าย
// ใช้กับคำสั่งความเร็ว (m/s), มุมเลี้ยว (rad) หรือค่าอื่นที่ห้ามกระโดด
#pragma once

#include <algorithm>
#include <cmath>

class RateLimiter
{
public:
  // max_up: อัตราเพิ่มสูงสุด (หน่วย/วินาที), max_down: อัตราลดสูงสุด (ค่าบวก)
  // ตั้ง max_down สูงกว่า max_up ได้ เพื่อให้ชะลอได้ไวกว่าเร่ง
  RateLimiter(double max_up, double max_down)
  : max_up_(max_up), max_down_(max_down) {}

  // คืนค่าใหม่ที่ขยับเข้าหา target ได้ไม่เกินอัตราที่กำหนดใน dt วินาที
  // "เพิ่ม/ลด" วัดจากขนาด |ค่า| เพื่อให้ฝั่งลบ (ถอยหลัง/เลี้ยวขวา) ทำงานสมมาตร
  double step(double target, double dt)
  {
    if (dt <= 0.0) {return value_;}
    double delta = target - value_;
    bool growing = (target * value_ >= 0.0) && (std::abs(target) > std::abs(value_));
    double limit = (growing ? max_up_ : max_down_) * dt;
    value_ += std::clamp(delta, -limit, limit);
    return value_;
  }

  // หยุดทันที (ใช้กับ watchdog / E-stop เท่านั้น ห้ามผ่าน ramp)
  void reset(double v = 0.0) {value_ = v;}
  double value() const {return value_;}

private:
  double max_up_, max_down_;
  double value_{0.0};
};
