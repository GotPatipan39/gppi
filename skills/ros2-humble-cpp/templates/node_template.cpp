// Template: ROS2 Humble C++ node ที่สั่ง hardware
// มี: parameter, timer, watchdog, clamp, ramp, safe shutdown, reconnect-friendly loop
// เวลาที่ใช้ตัดสินความปลอดภัย (watchdog, dt ของ ramp) ใช้ steady clock เสมอ ไม่ใช้ now() (ROS time)
// — ROS time หยุดเดินเมื่อ use_sim_time:=true แต่ไม่มี /clock แล้ว watchdog จะไม่มีวันตัด
#include <algorithm>
#include <chrono>
#include <cmath>
#include <memory>

#include "geometry_msgs/msg/twist.hpp"
#include "rclcpp/rclcpp.hpp"
#include "my_pkg/command_watchdog.hpp"
#include "my_pkg/rate_limiter.hpp"

using namespace std::chrono_literals;

class MyNode : public rclcpp::Node
{
public:
  MyNode()
  : Node("my_node"),
    // ---- parameters (ห้าม hard-code) ----
    rate_hz_(declare_parameter<double>("rate_hz", 20.0)),
    cmd_timeout_(declare_parameter<double>("cmd_timeout", 0.5)),
    max_speed_(declare_parameter<double>("max_speed", 0.3)),        // m/s
    accel_(declare_parameter<double>("max_accel", 0.3)),            // m/s^2
    decel_(declare_parameter<double>("max_decel", 0.6)),            // m/s^2 (ชะลอไวกว่าเร่ง)
    ramp_(accel_, decel_),
    watchdog_(cmd_timeout_)   // เริ่มต้นแบบหมดเวลา = หยุด จนกว่าจะได้คำสั่งแรก
  {
    // ---- interfaces ----
    cmd_sub_ = create_subscription<geometry_msgs::msg::Twist>(
      "cmd_vel", rclcpp::QoS(1).reliable(),
      [this](geometry_msgs::msg::Twist::SharedPtr msg) {
        // คำสั่งที่ไม่ใช่ตัวเลขจริงไม่นับเป็นคำสั่ง — ไม่ feed watchdog จึงหยุดเองเมื่อครบ timeout
        if (!std::isfinite(msg->linear.x)) {
          RCLCPP_WARN_THROTTLE(get_logger(), *get_clock(), 2000, "non-finite cmd ignored");
          return;
        }
        last_cmd_ = *msg;
        watchdog_.feed(CommandWatchdog::Clock::now());
      });

    last_tick_ = CommandWatchdog::Clock::now();
    auto period = std::chrono::duration<double>(1.0 / rate_hz_);
    timer_ = create_wall_timer(
      std::chrono::duration_cast<std::chrono::nanoseconds>(period),
      std::bind(&MyNode::on_timer, this));

    RCLCPP_INFO(get_logger(), "started (rate %.1f Hz, timeout %.2f s, max %.2f m/s)",
      rate_hz_, cmd_timeout_, max_speed_);
  }

  ~MyNode() override
  {
    // พยายามหยุดก่อนปิด — แต่ไม่ใช่กลไกความปลอดภัย (crash จะไม่ผ่านตรงนี้)
    ramp_.reset();
    send_command(0.0);
  }

private:
  void on_timer()
  {
    const auto t = CommandWatchdog::Clock::now();
    const double dt = std::chrono::duration<double>(t - last_tick_).count();
    last_tick_ = t;

    // 1) watchdog: หยุดทันที ไม่ผ่าน ramp
    if (watchdog_.expired(t)) {
      RCLCPP_WARN_THROTTLE(get_logger(), *get_clock(), 2000, "cmd timeout -> stop");
      ramp_.reset();
      send_command(0.0);
      return;
    }

    // 2) clamp
    double target = std::clamp(last_cmd_.linear.x, -max_speed_, max_speed_);
    if (target != last_cmd_.linear.x) {
      RCLCPP_WARN_THROTTLE(get_logger(), *get_clock(), 2000, "speed clamped to %.2f", target);
    }

    // 3) ramp (กลับทิศจะหยุดที่ 0 หนึ่งรอบก่อน — ดู rate_limiter.hpp)
    send_command(ramp_.step(target, dt));
  }

  void send_command(double /*speed*/)
  {
    // TODO: แปลงเป็นหน่วยอุปกรณ์ แล้วเขียนไป hardware
    // - ถ้าเขียนไม่สำเร็จ: log + publish สถานะ error, ห้าม throw ออกจาก callback
    // - ถ้ากลับทิศ: ramp ส่ง 0 ให้หนึ่งรอบแล้ว — ตอนเห็น 0 ให้เคลียร์ bit ทิศเดิม ก่อนตั้งทิศใหม่ในรอบถัดไป
  }

  double rate_hz_, cmd_timeout_, max_speed_, accel_, decel_;
  RateLimiter ramp_;
  CommandWatchdog watchdog_;
  geometry_msgs::msg::Twist last_cmd_;
  CommandWatchdog::Clock::time_point last_tick_;
  rclcpp::Subscription<geometry_msgs::msg::Twist>::SharedPtr cmd_sub_;
  rclcpp::TimerBase::SharedPtr timer_;
};

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<MyNode>());
  rclcpp::shutdown();
  return 0;
}
