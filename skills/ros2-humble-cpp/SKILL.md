---
name: ros2-humble-cpp
description: ใช้เมื่อเขียน แก้ ออกแบบ หรือ debug งาน ROS2 Humble ด้วย C++ (rclcpp) — สร้าง workspace/package, node, launch file, CMakeLists/package.xml, custom msg, colcon build, topic/QoS/parameter, tf2/URDF, odometry, node ที่สั่งมอเตอร์หรือ hardware, การรันบน mini PC และการพัฒนาบน WSL
---

# ROS2 Humble + C++

> เวอร์ชัน 3.2.0 — ดู [CHANGELOG.md](CHANGELOG.md)

## ก่อนเริ่มทุกงาน
1. อ่าน `CLAUDE.md` ของโปรเจกต์ที่เปิดอยู่ (ผังระบบ, hardware, address map, กฎเฉพาะเครื่อง) — ถ้าขัดกับ skill นี้ ให้ยึดของโปรเจกต์
2. ดูโครงสร้าง workspace และ package ที่มีอยู่ก่อน อย่าสร้างซ้ำ
3. ถ้างานมี Modbus ให้ใช้ skill `modbus` ร่วมด้วย

## สภาพแวดล้อม
- Ubuntu 22.04 + ROS2 Humble, node เขียนด้วย C++ (rclcpp), launch file เขียนเป็น Python (`*.launch.py`)
- **Humble เท่านั้น:** ไฟล์ใน `references/` ครอบคลุมหลาย distro — ใช้เฉพาะส่วนที่ใช้ได้กับ Humble, ข้ามคำแนะนำที่ระบุว่าเป็นของ Iron/Jazzy/Kilted/Rolling ขึ้นไป เช่น Humble ยังใช้ `ament_target_dependencies()` ได้ตามปกติ (อย่าเปลี่ยนเป็น `target_link_libraries(... dep::dep)` แบบ Jazzy)
- ถ้าไม่แน่ใจว่า API มีใน Humble ไหม ให้เช็กจาก header ใน `/opt/ros/humble/include` หรือ `--help` ของคำสั่ง ก่อนใช้
- workspace: ใช้ root ของโปรเจกต์ที่เปิดอยู่ (โฟลเดอร์ที่มี `src/`) ถ้ายังไม่มี ให้ถามผู้ใช้ก่อนสร้าง
- ทุก terminal ต้อง `source /opt/ros/humble/setup.bash` แล้ว `source <workspace>/install/setup.bash`

### เครื่องที่ใช้
| เครื่อง | ใช้ทำอะไร | ข้อควรระวัง |
|---|---|---|
| Windows + WSL (Ubuntu 22.04) | เขียนโค้ด, build, unit test, simulator | workspace ต้องอยู่ใน filesystem ของ WSL (`~/...`) **ไม่ใช่** `/mnt/c` หรือ `/mnt/d` (build ช้ามาก, permission/symlink เพี้ยน) / USB-serial ต้องส่งเข้า WSL ด้วย `usbipd` / ROS2 ข้ามเครื่องผ่าน LAN อาจต้องตั้ง WSL เป็น mirrored networking |
| mini PC บนเครื่องจักร (Ubuntu 22.04) | รันจริงกับ hardware | ตั้ง IP คงที่, udev, systemd (ดู references/system-bringup.md) |

คำสั่งที่ทำให้ hardware ขยับ ให้รันบน mini PC โดยผู้ใช้เท่านั้น

## ขอบเขต network (ค่าเริ่มต้น: local เท่านั้น)
งานส่วนใหญ่ต้องเป็น **local เท่านั้น** — ถ้า CLAUDE.md ของโปรเจกต์ไม่ได้บอกเป็นอย่างอื่น ให้ออกแบบตามนี้

**ROS2 traffic อยู่ในเครื่องเดียว (ค่าเริ่มต้น)**
```bash
export ROS_LOCALHOST_ONLY=1      # Humble: DDS คุยเฉพาะ localhost ไม่ออก LAN
export ROS_DOMAIN_ID=<0-101>     # แยกจากระบบอื่น — ใช้เลขตาม CLAUDE.md ของโปรเจกต์
```
- ต้องตั้ง **ค่าเดียวกันในทุก process** ที่เกี่ยวข้อง: terminal, `~/.bashrc`, launch, systemd unit (`Environment=`), PM2 (`env:`) — ถ้า node ตัวไหนตั้งไม่ตรง จะมองไม่เห็นกันโดยไม่มี error
- เปลี่ยนค่าแล้วต้อง `ros2 daemon stop` ก่อน ไม่งั้น `ros2 topic list` จะแสดงผลจาก daemon เก่า
- `ROS_LOCALHOST_ONLY` เป็นของ Humble — ใน Jazzy ขึ้นไปเปลี่ยนเป็น `ROS_AUTOMATIC_DISCOVERY_RANGE=LOCALHOST` (อย่าใช้ใน Humble)
- `ROS_DOMAIN_ID` เลือกในช่วง 0–101 ได้ปลอดภัยบน Linux

**ถ้าต้องคุยข้ามเครื่อง** (เช่น laptop ดู topic ของ mini PC, teleop จากเครื่องอื่น)
- ต้องปิด `ROS_LOCALHOST_ONLY` บนทุกเครื่องที่เกี่ยวข้อง และตั้ง `ROS_DOMAIN_ID` ให้ตรงกัน
- ใช้ LAN แยกของเครื่องจักร ไม่ใช่ LAN ออฟฟิศ / เปิด firewall เฉพาะวงนั้น
- ถามผู้ใช้ก่อนเปลี่ยนจาก localhost เป็นข้ามเครื่องเสมอ

**ไม่พึ่ง internet/cloud ตอนรัน**
- ห้ามออกแบบให้ระบบต้องต่อ internet หรือ cloud service ตอนใช้งาน (ทุกอย่างอยู่ใน LAN ของเครื่องจักร)
- ห้ามดึง dependency ตอน runtime/บูต — `rosdep install`, `apt`, `pip` ทำตอน setup เท่านั้น
- ถ้าเครื่องหน้างานไม่มี internet: build บนเครื่อง dev (WSL) แล้วนำ `install/` ไปวาง หรือเตรียม .deb/wheel ไว้ล่วงหน้า (เครื่อง dev และ mini PC ต้องเป็น Ubuntu 22.04 + Humble เหมือนกัน)

**สิ่งที่ไม่เกี่ยวกับ ROS_LOCALHOST_ONLY:** การเชื่อมต่อที่ node เปิดเอง เช่น Modbus TCP ไป PLC ยังไปทาง LAN ได้ตามปกติ — ตั้งค่านี้แล้ว bridge node ยังคุยกับ PLC ได้

## หลักการทำงาน (สำคัญกว่าทุกหัวข้อด้านล่าง)
1. **ดูก่อนแก้:** อ่านโค้ดและหลักฐานที่มี (log, `ros2 topic info -v`, ค่า parameter ที่รันอยู่จริง) ก่อนเสนอวิธีแก้ เริ่มจากคำสั่งที่อ่านอย่างเดียวและไม่ทำให้อะไรขยับ
2. **ไฟล์ YAML ไม่ใช่หลักฐาน:** ค่าที่ node ใช้อยู่จริงให้เช็กด้วย `ros2 param get` เพราะอาจถูก launch override หรือ build ยังไม่ได้ install ไฟล์ใหม่
3. **QoS ไม่ตรงกัน:** ดูทั้งฝั่ง publisher และ subscriber (`ros2 topic info -v`) ก่อนเปลี่ยน profile ฝั่งใดฝั่งหนึ่ง
4. **ส่งคำสั่งหยุดไม่ได้แปลว่าหยุดแล้ว:** publish Twist ศูนย์ หรือเขียนไป driver สำเร็จ ยังไม่ใช่หลักฐานว่ามอเตอร์หยุด ต้องอ่านสถานะกลับจากอุปกรณ์ปลายทาง และต้องมี E-stop ทาง hardware ที่ไม่ผ่าน ROS2 เสมอ
5. **ผ่าน test ไม่ได้แปลว่าปลอดภัยบนเครื่องจริง:** รายงานระดับการทดสอบให้ชัด — build ผ่าน / unit test / simulator / hardware แบบยกล้อหรือไม่มีโหลด / ใช้งานจริง ห้ามรายงานผลระดับต่ำด้วยคำพูดของระดับสูง (ดู [references/testing.md](references/testing.md) หัวข้อ 11)
6. **ห้ามรัน launch หรือคำสั่งที่ทำให้ hardware ขยับเอง** ถ้าผู้ใช้ไม่ได้สั่งชัดเจน
7. **ห้ามลดเกณฑ์ความปลอดภัย** (timeout, limit, ramp, watchdog) เพียงเพื่อให้ test ผ่าน
8. **ห้ามเดาค่า hardware** (address, wheelbase, gear ratio, scale, หน่วย) ถ้าไม่มีใน CLAUDE.md หรือโค้ด ให้ถาม

## เปิดอ่าน reference ตามงาน
อ่านเฉพาะหัวข้อ (`##`) ที่ตรงกับงาน ไม่ต้องอ่านทั้งไฟล์

| งาน | ไฟล์ |
|---|---|
| workspace, package, CMake, rosdep | [references/workspace-build.md](references/workspace-build.md) |
| node, executor, callback group, thread | [references/nodes-executors.md](references/nodes-executors.md) |
| topic, service, action, QoS/DDS | [references/communication.md](references/communication.md) |
| lifecycle node, component | [references/lifecycle-components.md](references/lifecycle-components.md) |
| launch file | [references/launch-system.md](references/launch-system.md) |
| ros2_control, serial/CAN, hardware error recovery | [references/hardware-interface.md](references/hardware-interface.md) |
| E-stop, command arbitration, ทดสอบการหยุด | [references/safety-estop.md](references/safety-estop.md) |
| udev, systemd ให้รันตอนบูต, watchdog | [references/system-bringup.md](references/system-bringup.md) |
| debug, rosbag2, tracing | [references/debugging.md](references/debugging.md) |
| gtest, launch_testing, CI | [references/testing.md](references/testing.md) |
| tf2, URDF | [references/tf2-urdf.md](references/tf2-urdf.md) |
| กล้อง, OpenCV, cv_bridge, object detection | [references/perception.md](references/perception.md) |
| message type, หน่วย, frame | [references/message-types.md](references/message-types.md) |
| Web UI / dashboard ↔ ROS2 (rosbridge, bridge, teleop จาก browser) | skill `industrial-ui` → platforms/ros2-bridge.md |

ไฟล์ใน `references/` มาจาก [ros2-engineering-skills](https://github.com/dbwls99706/ros2-engineering-skills) v1.6.2 (Apache-2.0) ส่วนที่อ้างถึง `scripts/*.py` ไม่ได้รวมมาด้วย ให้ใช้คำสั่ง `ros2` CLI แทน

## Template
| ไฟล์ | ใช้ทำ |
|---|---|
| [templates/node_template.cpp](templates/node_template.cpp) | node พร้อม parameter, timer, watchdog, ramp, safe shutdown |
| [templates/package.xml](templates/package.xml) | package.xml (ament_cmake) |
| [templates/CMakeLists.txt](templates/CMakeLists.txt) | node + library ภายใน + gtest + install launch/config |
| [templates/example.launch.py](templates/example.launch.py) | launch ที่โหลด params.yaml และรับ argument |
| [templates/params.yaml](templates/params.yaml) | รูปแบบไฟล์ parameter |
| [templates/rate_limiter.hpp](templates/rate_limiter.hpp) | ramp (จำกัดความเร่ง) — logic ล้วน ไม่ใช้ rclcpp |
| [templates/test_example.cpp](templates/test_example.cpp) | gtest ของ rate_limiter (ทดสอบผ่านแล้ว 7/7) |

วางไฟล์ใน package ตามนี้: `src/my_node.cpp`, `include/my_pkg/rate_limiter.hpp`, `test/test_example.cpp`, `launch/`, `config/params.yaml` แล้วแทนที่ `my_pkg` / `my_node` ด้วยชื่อจริง

สถานะการทดสอบ template: `rate_limiter.hpp` + gtest คอมไพล์และผ่านแล้ว; launch/package.xml/yaml ตรวจ syntax แล้ว; `node_template.cpp` และ `CMakeLists.txt` **ยังไม่เคย build กับ ROS2 Humble จริง** — build ครั้งแรกให้ตรวจ error แล้วแก้ template นี้ด้วย

## โครงสร้าง workspace ที่แนะนำ
```
<workspace>/
├── CLAUDE.md                  ← ข้อมูลเฉพาะโปรเจกต์
└── src/
    ├── <proj>_interfaces/     ← msg/srv/action อย่างเดียว ไม่มี node
    ├── <proj>_<logic>/        ← คณิตศาสตร์/ตรรกะล้วน (kinematics, state machine) + gtest
    ├── <proj>_<hw>_bridge/    ← node ตัวเดียวที่คุยกับ hardware นั้นๆ
    ├── <proj>_description/    ← URDF/xacro
    └── <proj>_bringup/        ← launch, config yaml, udev rules, systemd unit
```
- **แยก logic ออกจาก I/O:** คณิตศาสตร์อยู่ใน class/library ธรรมดาที่ไม่ include rclcpp → เขียน gtest ได้โดยไม่ต้องต่อ hardware
- hardware แต่ละชิ้น (PLC, serial device) มี node เจ้าของได้ตัวเดียว

## สร้าง package
```bash
cd <workspace>/src
ros2 pkg create <pkg_name> --build-type ament_cmake --dependencies rclcpp std_msgs geometry_msgs
```
- ชื่อ package / node / topic ใช้ snake_case
- custom msg/srv แยกไว้ใน package `<proj>_interfaces` เสมอ

## รูปแบบ node
- class สืบทอด `rclcpp::Node`, ใช้ `std::chrono_literals`
- ค่าที่ปรับได้ (พอร์ต, IP, rate, gain, limit) ต้องเป็น parameter ผ่าน `declare_parameter` ห้าม hard-code
- ใช้ timer (`create_wall_timer`) สำหรับงานวนรอบ ห้ามใช้ `while` + `sleep` ใน callback
- งาน I/O ที่อาจค้าง (Modbus, serial ที่มี timeout) ให้อยู่ใน timer ของตัวเอง แยก callback group ถ้า node มี callback อื่นที่ต้องเร็ว
- QoS เริ่มต้น:
  - ข้อมูลเซนเซอร์ (กล้อง, encoder ความถี่สูง): `rclcpp::SensorDataQoS()` (best effort, ใช้ค่าล่าสุด)
  - คำสั่ง (`/cmd_vel`): `rclcpp::QoS(1).reliable()` (เอาค่าล่าสุด ไม่สะสมคิวคำสั่งเก่า)
  - สถานะ/ค่าที่ node ที่เพิ่งเปิดต้องได้ (map, config): `rclcpp::QoS(1).reliable().transient_local()`
- node ที่ถือ hardware ควรพิจารณาใช้ lifecycle node เพื่อแยกขั้นเชื่อมต่อ (configure) กับขั้นเริ่มสั่งงาน (activate) — ไม่บังคับ ให้เลือกตามความซับซ้อนของงาน
- log ด้วย `RCLCPP_INFO/WARN/ERROR`, ข้อความที่ซ้ำถี่ใช้ `RCLCPP_WARN_THROTTLE`
- หน่วยตาม REP-103: เมตร, เรเดียน, m/s, rad/s; มุมบวก = หมุนทวนเข็ม (ซ้าย) — แปลงเป็นหน่วยอุปกรณ์ (%, องศา, pulse) ที่ bridge node เท่านั้น

## ความปลอดภัย (node ที่สั่งมอเตอร์หรือ hardware)
- **watchdog:** ไม่ได้รับคำสั่งเกิน timeout (ค่าเริ่มต้น 0.5 s) → สั่งหยุด
- **ramp:** จำกัดอัตราเปลี่ยนของคำสั่ง (ความเร่ง m/s², อัตราเลี้ยว rad/s) ห้ามส่งคำสั่งกระโดดจาก 0 ไปค่าสูงทันที — ยกเว้นคำสั่งหยุดจาก watchdog/E-stop ซึ่งต้องหยุดทันที
- **clamp:** จำกัดค่าก่อนส่งเสมอ และ log เมื่อค่าถูก clamp
- **กลับทิศ:** ต้องลดความเร็วถึง 0 ก่อน แล้วค่อยกลับทิศ
- **shutdown:** ส่งคำสั่งหยุดก่อนปิดการเชื่อมต่อ (แต่ destructor ไม่ใช่กลไกความปลอดภัย — ถ้า process crash จะไม่ถูกเรียก)
- **ฝั่งอุปกรณ์ต้องมี watchdog ของตัวเอง** (heartbeat หรือ communication timeout) เพราะถ้า PC ค้าง ROS2 ส่งคำสั่งหยุดไม่ได้ — ถ้ายังไม่มี ให้แนะนำผู้ใช้เพิ่ม
- การสื่อสารกับ hardware ขาด → publish สถานะ error และ reconnect แบบมีช่วงพัก ห้าม crash ทั้ง node
- ทดสอบครั้งแรกหลังแก้โค้ดสั่งมอเตอร์: ยกล้อ/ไม่มีโหลด และตั้ง limit ความเร็วต่ำ

## CMakeLists.txt / package.xml — ส่วนที่ลืมบ่อย
- dependency ใหม่ต้องเพิ่มทั้งใน `CMakeLists.txt` (find_package + ament_target_dependencies) **และ** `package.xml` (`<depend>`)
- ลืม `install(TARGETS ...)` → `ros2 run` หา executable ไม่เจอ
- ลืม `install(DIRECTORY launch config ...)` → launch หาไฟล์ yaml ไม่เจอ
- library ภายนอกที่ไม่ใช่ ROS (เช่น libmodbus) ใช้ `pkg_check_modules` (ดู template)

## Build และรัน
```bash
cd <workspace>
rosdep install --from-paths src -y --ignore-src
colcon build --symlink-install --packages-select <pkg_name>
source install/setup.bash
colcon test --packages-select <pkg_name> && colcon test-result --verbose
ros2 launch <pkg_name> <file>.launch.py
```
หลังแก้โค้ด ให้ build เฉพาะ package ที่แก้ แล้วรายงานผล build (warning/error) ทุกครั้ง

## คำสั่ง debug
```bash
ros2 node list / ros2 node info /<node>
ros2 topic list -t / ros2 topic echo /<topic> / ros2 topic hz /<topic> / ros2 topic info -v /<topic>
ros2 topic pub --once /cmd_vel geometry_msgs/msg/Twist "{linear: {x: 0.1}}"   # ⚠️ ทำให้เครื่องขยับ
ros2 param list /<node> / ros2 param get /<node> <param>
ros2 run tf2_ros tf2_echo odom base_link
ros2 doctor --report
rqt_graph
```

## ปัญหาที่เจอบ่อย
| อาการ | สาเหตุที่น่าจะเป็น |
|---|---|
| `Package '<x>' not found` | ยังไม่ได้ source `install/setup.bash` หรือ build ไม่ผ่าน |
| `No executable found` | ลืม `install(TARGETS ...)` |
| echo topic แล้วไม่มีข้อมูล | QoS ไม่ตรงกัน (reliable vs best_effort) — เช็ก `ros2 topic info -v` |
| `Permission denied: /dev/ttyUSB0` | user ยังไม่อยู่ในกลุ่ม `dialout` (`sudo usermod -aG dialout $USER` แล้ว logout) |
| ชื่อพอร์ต USB สลับกันหลังรีบูต | ใช้ udev rule ตั้งชื่อคงที่ |
| เห็น node ข้ามเครื่องไม่ได้ / เห็นของคนอื่น | ตั้ง `ROS_LOCALHOST_ONLY=1` อยู่ (ตั้งใจ), `ROS_DOMAIN_ID` ไม่ตรงกัน, firewall, หรือ WSL ใช้ NAT networking |
| node ในเครื่องเดียวกันมองไม่เห็นกัน | `ROS_LOCALHOST_ONLY` / `ROS_DOMAIN_ID` ตั้งไม่เหมือนกันในทุก process (เช่น ลืมใส่ใน PM2/systemd) หรือยังไม่ได้ `ros2 daemon stop` |
| build บน WSL ช้ามาก | workspace อยู่ใน `/mnt/c` หรือ `/mnt/d` → ย้ายไป `~/` |

## สรุปผลงานแต่ละครั้ง
```
สิ่งที่แก้: <ไฟล์/ตำแหน่ง และสิ่งที่เปลี่ยน>
หลักฐาน: <คำสั่งที่รันและผลที่ได้จริง>
ทดสอบถึงระดับ: <build / unit test / simulator / hardware ไม่มีโหลด / ใช้งานจริง>
ยังเหลือ: <สิ่งที่ยังไม่ได้ทดสอบ หรือต้องให้ผู้ใช้ทำเอง>
```
อธิบายสั้นๆ เป็นภาษาไทย ใช้ศัพท์เทคนิคเป็นภาษาอังกฤษ
