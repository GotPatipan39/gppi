// Template: gtest สำหรับ logic ที่ไม่แตะ ROS/hardware
// รันด้วย: colcon test --packages-select my_pkg && colcon test-result --verbose
#include <gtest/gtest.h>

#include "my_pkg/rate_limiter.hpp"

TEST(RateLimiter, RampsUpAtLimitedRate)
{
  RateLimiter r(/*max_up=*/1.0, /*max_down=*/2.0);
  EXPECT_DOUBLE_EQ(r.step(1.0, 0.1), 0.1);
  EXPECT_DOUBLE_EQ(r.step(1.0, 0.1), 0.2);
}

TEST(RateLimiter, SlowsDownFasterThanSpeedsUp)
{
  RateLimiter r(1.0, 2.0);
  r.reset(1.0);
  EXPECT_DOUBLE_EQ(r.step(0.0, 0.1), 0.8);
}

TEST(RateLimiter, NegativeSideIsSymmetric)
{
  RateLimiter r(1.0, 2.0);
  EXPECT_DOUBLE_EQ(r.step(-1.0, 0.1), -0.1);  // เร่งถอยหลังใช้ max_up
  r.reset(-1.0);
  EXPECT_DOUBLE_EQ(r.step(0.0, 0.1), -0.8);   // ชะลอใช้ max_down
}

TEST(RateLimiter, ReversingPassesThroughZeroWithDecelRate)
{
  RateLimiter r(1.0, 2.0);
  r.reset(0.1);
  EXPECT_NEAR(r.step(-1.0, 0.1), -0.1, 1e-12);  // ข้ามศูนย์ ใช้อัตราชะลอ
}

TEST(RateLimiter, ReachesTargetWithoutOvershoot)
{
  RateLimiter r(1.0, 1.0);
  for (int i = 0; i < 100; ++i) {r.step(0.35, 0.1);}
  EXPECT_DOUBLE_EQ(r.value(), 0.35);
}

TEST(RateLimiter, ResetStopsImmediately)
{
  RateLimiter r(1.0, 1.0);
  r.reset(0.8);
  r.reset();
  EXPECT_DOUBLE_EQ(r.value(), 0.0);
}

TEST(RateLimiter, IgnoresNonPositiveDt)
{
  RateLimiter r(1.0, 1.0);
  EXPECT_DOUBLE_EQ(r.step(1.0, 0.0), 0.0);
  EXPECT_DOUBLE_EQ(r.step(1.0, -0.1), 0.0);
}
