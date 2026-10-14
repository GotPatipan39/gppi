#!/usr/bin/env bash
# ทดสอบโค้ด template ที่คุม hardware ใน skill — ไม่ต้องมี ROS2 และไม่แตะอุปกรณ์จริง
#   1) gtest ของ ros2-humble-cpp (rate_limiter, command_watchdog, odometry ใน references/odometry.md)
#   2) compile node_template.cpp กับ rclcpp จำลอง (ตรวจ type/syntax เท่านั้น — ไม่ใช่การ build กับ ROS2 จริง)
#   3) modbus_client.hpp กับ libmodbus จริง + Modbus TCP server จำลองบน 127.0.0.1
# ต้องมี: g++ libgtest-dev libmodbus-dev python3   (Ubuntu: sudo apt-get install -y g++ libgtest-dev libmodbus-dev)
# รัน: bash tools/test-templates.sh   (ใน WSL หรือ Ubuntu; output ไปที่ไฟล์ชั่วคราว ไม่ลง repo)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TPL="$ROOT/skills/ros2-humble-cpp/templates"
MB="$ROOT/skills/modbus/clients"
OUT="$(mktemp -d)"
trap 'kill ${SRV:-} 2>/dev/null || true; rm -rf "$OUT"' EXIT
CXX="g++ -std=c++17 -Wall -Wextra -Werror"
$CXX --version | head -1

echo "== 1) gtest: rate_limiter + command_watchdog"
mkdir -p "$OUT/inc/my_pkg"
cp "$TPL"/*.hpp "$OUT/inc/my_pkg/"
$CXX -I"$OUT/inc" "$TPL/test_example.cpp" -lgtest -lgtest_main -pthread -o "$OUT/tests"
"$OUT/tests" --gtest_brief=1

echo "== 1b) gtest: diff_drive_odometry (code blocks in references/odometry.md)"
ODO="$ROOT/skills/ros2-humble-cpp/references/odometry.md"
# block แรก = header, block ที่สอง = gtest — เอกสารเปลี่ยนลำดับ block ต้องแก้ตรงนี้ด้วย
awk -v out="$OUT" '/^```cpp/{n++;on=1;next} /^```/{on=0;next} on{print > (out "/odo" n ".cpp")}' "$ODO"
cp "$OUT/odo1.cpp" "$OUT/inc/my_pkg/diff_drive_odometry.hpp"
$CXX -I"$OUT/inc" "$OUT/odo2.cpp" -lgtest -lgtest_main -pthread -o "$OUT/odo_tests"
"$OUT/odo_tests" --gtest_brief=1

echo "== 2) node_template.cpp compiles against a stub rclcpp"
mkdir -p "$OUT/inc/rclcpp" "$OUT/inc/geometry_msgs/msg"
cat > "$OUT/inc/geometry_msgs/msg/twist.hpp" <<'H'
#pragma once
#include <memory>
namespace geometry_msgs { namespace msg {
struct Vector3 { double x{0}, y{0}, z{0}; };
struct Twist { Vector3 linear, angular; using SharedPtr = std::shared_ptr<Twist>; };
}}
H
cat > "$OUT/inc/rclcpp/rclcpp.hpp" <<'H'
#pragma once
#include <chrono>
#include <functional>
#include <memory>
#include <string>
namespace rclcpp {
struct Logger {};
struct Clock {};
struct QoS { explicit QoS(int) {} QoS & reliable() { return *this; } };
struct TimerBase { using SharedPtr = std::shared_ptr<TimerBase>; };
template<class M> struct Subscription { using SharedPtr = std::shared_ptr<Subscription>; };
class Node {
public:
  explicit Node(const std::string &) {}
  virtual ~Node() = default;
  template<class T> T declare_parameter(const std::string &, T v) { return v; }
  template<class M, class F> typename Subscription<M>::SharedPtr create_subscription(const std::string &, QoS, F) { return {}; }
  template<class D, class F> TimerBase::SharedPtr create_wall_timer(D, F) { return {}; }
  Logger get_logger() const { return {}; }
  std::shared_ptr<Clock> get_clock() { return std::make_shared<Clock>(); }
};
inline void init(int, char **) {}
template<class T> void spin(T) {}
inline void shutdown() {}
inline Logger get_logger(const std::string &) { return {}; }
}
#define RCLCPP_INFO(logger, ...) ((void)(logger))
#define RCLCPP_FATAL(logger, ...) ((void)(logger))
#define RCLCPP_WARN_THROTTLE(logger, clock, ms, ...) ((void)(logger), (void)(clock), (void)(ms))
H
$CXX -Wno-unused-parameter -I"$OUT/inc" -c "$TPL/node_template.cpp" -o "$OUT/node.o"
echo "ok"

echo "== 3) modbus_client.hpp vs libmodbus $(grep -oP 'LIBMODBUS_VERSION_STRING "\K[^"]+' /usr/include/modbus/modbus-version.h) + fake server"
cat > "$OUT/server.py" <<'P'
# Modbus TCP server จิ๋ว: FC03 address+count <= 100 คืนค่า address, ไม่งั้นตอบ exception 02 (illegal data address)
import socket, struct, sys
s = socket.socket(); s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
s.bind(("127.0.0.1", 0)); s.listen(1)
print(s.getsockname()[1], flush=True)
conns = 0
while True:
    c, _ = s.accept(); conns += 1
    print("connection", conns, flush=True)
    while True:
        h = c.recv(7)
        if len(h) < 7: break
        tid, _, ln, uid = struct.unpack(">HHHB", h)
        pdu = c.recv(ln - 1); fc = pdu[0]
        addr, cnt = struct.unpack(">HH", pdu[1:5])
        body = (bytes([3, cnt * 2]) + b"".join(struct.pack(">H", addr + i) for i in range(cnt))
                if fc == 3 and addr + cnt <= 100 else bytes([fc | 0x80, 2]))
        c.sendall(struct.pack(">HHHB", tid, 0, len(body) + 1, uid) + body)
    c.close()
P
cat > "$OUT/check.cpp" <<C
#include "$MB/modbus_client.hpp"
#include <cstdio>
#include <cstdlib>
int main(int, char ** argv) {
  ModbusTcpClient c("127.0.0.1", std::atoi(argv[1]), 0.5, 0.0, /*unit_id=*/1);
  if (!c.ensure_connected()) { std::printf("connect failed: %s\n", c.last_error().c_str()); return 1; }
  std::vector<uint16_t> rx;
  int fails = 0;
  if (!c.read_registers(5, 2, rx) || rx[0] != 5) { std::printf("FAIL valid read\n"); ++fails; }
  if (c.read_registers(60000, 2, rx) || !c.last_was_device_exception() || !c.connected()) {
    std::printf("FAIL device exception must keep the link: ok/exc/conn\n"); ++fails;
  }
  if (!c.read_registers(0, 1, rx)) { std::printf("FAIL read after exception\n"); ++fails; }
  std::printf("%s\n", fails ? "modbus FAILED" : "ok");
  return fails;
}
C
$CXX "$OUT/check.cpp" -I/usr/include/modbus -lmodbus -o "$OUT/check"
python3 "$OUT/server.py" > "$OUT/server.log" &
SRV=$!
for _ in $(seq 50); do [ -s "$OUT/server.log" ] && break; sleep 0.1; done
"$OUT/check" "$(head -1 "$OUT/server.log")"
sleep 0.2
CONNS=$(grep -c '^connection' "$OUT/server.log")
[ "$CONNS" = 1 ] || { echo "FAIL expected 1 connection (no reconnect loop), got $CONNS"; exit 1; }

echo "== all template checks passed"
