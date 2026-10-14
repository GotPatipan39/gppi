// Template: ตัวจำกัดอัตราเปลี่ยน (ramp) — logic ล้วน ไม่ include rclcpp จึงเขียน gtest ได้ง่าย
// ใช้กับคำสั่งความเร็ว (m/s), มุมเลี้ยว (rad) หรือค่าอื่นที่ห้ามกระโดด
#pragma once

#include <algorithm>
#include <cmath>
#include <stdexcept>
#include <string>

class RateLimiter
{
public:
  // max_up: อัตราเพิ่มสูงสุด (หน่วย/วินาที), max_down: อัตราลดสูงสุด (ค่าบวก)
  // ตั้ง max_down สูงกว่า max_up ได้ เพื่อให้ชะลอได้ไวกว่าเร่ง
  // max_dt: dt ที่ใช้ได้มากสุดต่อ step — executor/timer ค้างแล้ว dt ใหญ่ = ramp กระโดดถึง target ในรอบเดียว
  //         node ควรตั้งเป็นราว 2 รอบของ timer — ไม่มีค่าเริ่มต้นโดยตั้งใจ ให้ผู้ใช้เลือกตาม rate ของ loop
  //         (ใช้กับขาชะลอด้วย: executor ค้างแล้วชะลอได้ทีละ max_dt ไม่ใช่รวดเดียว — watchdog ยังตัดทันทีเมื่อครบ timeout)
  // ค่าที่ไม่ใช่ตัวเลขจริงหรือ ≤ 0 → throw (NaN ทำให้ clamp คืน delta ทั้งก้อน, ติดลบทำให้ clamp เป็น UB)
  RateLimiter(double max_up, double max_down, double max_dt)
  : max_up_(require_positive(max_up, "max_up")),
    max_down_(require_positive(max_down, "max_down")),
    max_dt_(require_positive(max_dt, "max_dt")) {}

  // คืนค่าใหม่ที่ขยับเข้าหา target ได้ไม่เกินอัตราที่กำหนดใน dt วินาที
  // "เพิ่ม/ลด" วัดจากขนาด |ค่า| เพื่อให้ฝั่งลบ (ถอยหลัง/เลี้ยวขวา) ทำงานสมมาตร
  // - target ไม่ใช่ตัวเลขจริง (NaN/Inf) = ชะลอลงหา 0 — std::clamp(NaN, …) คืน NaN แล้วค้างใน value_ ตลอด
  // - dt ไม่ใช่ตัวเลขจริงหรือ ≤ 0 = ไม่ขยับ — clamp กับ limit ที่เป็น NaN คืน delta ทั้งก้อน (กระโดดถึง target ทันที)
  // - กลับทิศ: หยุดที่ 0 หนึ่งรอบก่อน — drive ที่ใช้ bit ทิศทางต้องเห็น 0 ก่อนเปลี่ยนทิศ
  double step(double target, double dt)
  {
    if (!std::isfinite(dt) || dt <= 0.0) {return value_;}
    dt = std::min(dt, max_dt_);
    if (!std::isfinite(target)) {target = 0.0;}
    const bool reversing = (target * value_ < 0.0);
    if (reversing) {target = 0.0;}
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
  static double require_positive(double v, const char * name)
  {
    if (!std::isfinite(v) || v <= 0.0) {
      throw std::invalid_argument(std::string("RateLimiter: ") + name + " must be finite and > 0");
    }
    return v;
  }

  double max_up_, max_down_, max_dt_;
  double value_{0.0};
};
