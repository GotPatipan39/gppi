// Template: gtest สำหรับ logic ที่ไม่แตะ ROS/hardware
// รันด้วย: colcon test --packages-select my_pkg && colcon test-result --verbose
// (ใน repo gppi: bash tools/test-templates.sh — ไม่ต้องมี ROS2)
#include <gtest/gtest.h>

#include "my_pkg/rate_limiter.hpp"
#include "my_pkg/command_watchdog.hpp"

#include <cmath>
#include <limits>
#include <stdexcept>

TEST(RateLimiter, RampsUpAtLimitedRate)
{
  RateLimiter r(/*max_up=*/1.0, /*max_down=*/2.0, /*max_dt=*/1.0);
  EXPECT_DOUBLE_EQ(r.step(1.0, 0.1), 0.1);
  EXPECT_DOUBLE_EQ(r.step(1.0, 0.1), 0.2);
}

TEST(RateLimiter, SlowsDownFasterThanSpeedsUp)
{
  RateLimiter r(1.0, 2.0, 1.0);
  r.reset(1.0);
  EXPECT_DOUBLE_EQ(r.step(0.0, 0.1), 0.8);
}

TEST(RateLimiter, NegativeSideIsSymmetric)
{
  RateLimiter r(1.0, 2.0, 1.0);
  EXPECT_DOUBLE_EQ(r.step(-1.0, 0.1), -0.1);  // เร่งถอยหลังใช้ max_up
  r.reset(-1.0);
  EXPECT_DOUBLE_EQ(r.step(0.0, 0.1), -0.8);   // ชะลอใช้ max_down
}

// drive ที่ใช้ bit ทิศทางต้องเห็นค่า 0 อย่างน้อย 1 รอบก่อนกลับทิศ — ห้ามกระโดดข้ามศูนย์ใน step เดียว
TEST(RateLimiter, ReversingStopsAtZeroForOneStepFirst)
{
  RateLimiter r(1.0, 2.0, 1.0);
  r.reset(0.1);
  EXPECT_DOUBLE_EQ(r.step(-1.0, 0.1), 0.0);     // ชะลอได้ถึง -0.1 แต่หยุดที่ 0 ก่อน
  EXPECT_NEAR(r.step(-1.0, 0.1), -0.1, 1e-12);  // รอบถัดไปค่อยเร่งไปทางลบด้วย max_up
}

TEST(RateLimiter, ReversingFromNegativeAlsoStopsAtZero)
{
  RateLimiter r(1.0, 2.0, 1.0);
  r.reset(-0.1);
  EXPECT_DOUBLE_EQ(r.step(1.0, 0.1), 0.0);
}

// NaN/Inf จาก publisher ที่พัง: std::clamp(NaN, ...) คืน NaN แล้วค้างใน ramp ตลอด → ถือเป็น "หยุด"
TEST(RateLimiter, NonFiniteTargetMeansStop)
{
  RateLimiter r(1.0, 2.0, 1.0);
  r.reset(1.0);
  EXPECT_DOUBLE_EQ(r.step(std::numeric_limits<double>::quiet_NaN(), 0.1), 0.8);
  EXPECT_DOUBLE_EQ(r.step(std::numeric_limits<double>::infinity(), 0.1), 0.6);
  EXPECT_TRUE(std::isfinite(r.value()));
}

TEST(RateLimiter, NonFiniteDtIsIgnored)
{
  RateLimiter r(1.0, 1.0, 1.0);
  r.reset(0.5);
  EXPECT_DOUBLE_EQ(r.step(1.0, std::numeric_limits<double>::quiet_NaN()), 0.5);
}

// executor ค้างหลายวินาทีแล้วคำสั่งมาก่อน timer รอบถัดไป → dt ใหญ่ = ramp กระโดดถึงความเร็วสูงสุดในรอบเดียว
TEST(RateLimiter, CapsLargeDt)
{
  RateLimiter r(1.0, 2.0, /*max_dt=*/0.1);
  EXPECT_DOUBLE_EQ(r.step(1.0, 5.0), 0.1);   // ใช้ได้แค่ 0.1 s ไม่ใช่ 5 s
}

// ค่า parameter ผิด (NaN, ติดลบ, 0) ทำให้ ramp กระโดด / clamp เป็น UB → ไม่ยอมสร้าง (node ไม่ start)
TEST(RateLimiter, RejectsInvalidLimits)
{
  const double nan = std::numeric_limits<double>::quiet_NaN();
  EXPECT_THROW(RateLimiter(nan, 1.0, 1.0), std::invalid_argument);
  EXPECT_THROW(RateLimiter(1.0, -1.0, 1.0), std::invalid_argument);
  EXPECT_THROW(RateLimiter(0.0, 1.0, 1.0), std::invalid_argument);
  EXPECT_THROW(RateLimiter(1.0, 1.0, /*max_dt=*/0.0), std::invalid_argument);
}

TEST(CommandWatchdog, RejectsInvalidTimeout)
{
  EXPECT_THROW(CommandWatchdog(std::numeric_limits<double>::infinity(), 0.05), std::invalid_argument);
  EXPECT_THROW(CommandWatchdog(std::numeric_limits<double>::quiet_NaN(), 0.05), std::invalid_argument);
  EXPECT_THROW(CommandWatchdog(0.0, 0.05), std::invalid_argument);
  // ใหญ่จนแปลงเป็น duration ไม่ได้ (overflow = UB) — ไม่ใช่เพดานของงาน เพดานจริงมาจากโปรเจกต์
  EXPECT_THROW(CommandWatchdog(1e300, 0.05), std::invalid_argument);
  EXPECT_NO_THROW(CommandWatchdog(3600.0, 0.05));
}

// timer ที่ตรวจ watchdog ต้องเร็วกว่า timeout พอสมควร — rate 0.5 Hz กับ timeout 0.5 s = ตรวจทุก 2 s
TEST(CommandWatchdog, RejectsTimeoutShorterThanThreeChecks)
{
  EXPECT_THROW(CommandWatchdog(0.5, 2.0), std::invalid_argument);
  EXPECT_THROW(CommandWatchdog(0.5, 0.2), std::invalid_argument);   // 0.5 < 3 × 0.2
  EXPECT_NO_THROW(CommandWatchdog(0.5, 0.05));                      // 20 Hz
  EXPECT_NO_THROW(CommandWatchdog(0.15, 0.05));                     // 3 รอบพอดี (3 × 0.05 = 0.15000000000000002 ใน double)
  EXPECT_THROW(CommandWatchdog(0.5, 0.0), std::invalid_argument);
}

// watchdog ใช้ steady clock — ROS time (now()) หยุดเดินเมื่อ use_sim_time:=true บนเครื่องจริงที่ไม่มี /clock
TEST(CommandWatchdog, ExpiredBeforeFirstCommand)
{
  CommandWatchdog w(0.5, 0.05);
  EXPECT_TRUE(w.expired(CommandWatchdog::Clock::now()));  // ยังไม่เคยได้คำสั่ง = หยุด
}

TEST(CommandWatchdog, FreshAfterFeedThenExpiresAfterTimeout)
{
  using namespace std::chrono_literals;
  CommandWatchdog w(0.5, 0.05);
  const auto t0 = CommandWatchdog::Clock::now();
  w.feed(t0);
  EXPECT_FALSE(w.expired(t0 + 400ms));
  EXPECT_TRUE(w.expired(t0 + 600ms));
  w.feed(t0 + 600ms);
  EXPECT_FALSE(w.expired(t0 + 700ms));
}

TEST(RateLimiter, ReachesTargetWithoutOvershoot)
{
  RateLimiter r(1.0, 1.0, 1.0);
  for (int i = 0; i < 100; ++i) {r.step(0.35, 0.1);}
  EXPECT_DOUBLE_EQ(r.value(), 0.35);
}

TEST(RateLimiter, ResetStopsImmediately)
{
  RateLimiter r(1.0, 1.0, 1.0);
  r.reset(0.8);
  r.reset();
  EXPECT_DOUBLE_EQ(r.value(), 0.0);
}

TEST(RateLimiter, IgnoresNonPositiveDt)
{
  RateLimiter r(1.0, 1.0, 1.0);
  EXPECT_DOUBLE_EQ(r.step(1.0, 0.0), 0.0);
  EXPECT_DOUBLE_EQ(r.step(1.0, -0.1), 0.0);
}
