# C++ ด้วย libmodbus

ใช้ [modbus_client.hpp](modbus_client.hpp) เป็นจุดเริ่ม (ทดสอบแล้วกับ libmodbus 3.1.10 + `tools/modbus_sim.py`: อ่าน/เขียน register, coil, int16 ติดลบ, int32 แบบ low word ก่อน, reconnect หลัง server หลุด)
- ⚠️ เครื่อง runtime Ubuntu 22.04 ได้ libmodbus **3.1.6** จาก apt — ยังไม่ได้ทดสอบ template กับ 3.1.6
- ⚠️ การแยก exception ของอุปกรณ์ออกจาก error ของสาย และ `unit_id` (เพิ่ม 2026-10-14) ยังไม่ได้ compile/ทดสอบ — ทดสอบกับ `modbus_sim.py` (อ่าน address ที่ไม่มี → ต้องได้ `last_was_device_exception()` และ `connected()` ยังเป็น true) ก่อนใช้กับเครื่องจริง

## ติดตั้ง
```bash
sudo apt install libmodbus-dev     # Ubuntu 22.04 ได้ 3.1.6, 24.04 ได้ 3.1.10
```

## CMake
```cmake
find_package(PkgConfig REQUIRED)
pkg_check_modules(MODBUS REQUIRED libmodbus)
target_include_directories(my_target PRIVATE ${MODBUS_INCLUDE_DIRS})
target_link_libraries(my_target ${MODBUS_LIBRARIES})
```
ใน ROS2 package ให้เพิ่ม `<depend>libmodbus-dev</depend>` ใน `package.xml` (rosdep key คือ `libmodbus-dev`)

## การใช้งาน
```cpp
#include "modbus_client.hpp"

ModbusTcpClient plc(ip, 502, /*timeout_s=*/0.2, /*retry_s=*/1.0);
// ผ่าน gateway TCP→RTU: ใส่ unit ID ของอุปกรณ์ปลายทางเป็นตัวที่ 5 — ค่าจากคู่มือ/CLAUDE.md ห้ามเดา
// ModbusTcpClient meter(gw_ip, 502, 0.5, 1.0, /*unit_id=*/meter_id);

void on_timer() {
  if (!plc.ensure_connected()) { /* publish สถานะ error, สั่งหยุดฝั่งที่ทำได้ */ return; }

  std::vector<uint16_t> rx;
  if (!plc.read_registers(100, 8, rx)) {                                     // อ่านบล็อกเดียว
    log(plc.last_error());   // last_was_device_exception() = address/ค่าผิด (แก้โค้ด) ไม่ใช่สายหลุด
    return;
  }
  int16_t angle = ModbusTcpClient::to_int16(rx[0]);
  int32_t count = ModbusTcpClient::to_int32_lo_hi(rx[2], rx[3]);             // Mitsubishi/Delta

  plc.write_registers(0, {speed, ModbusTcpClient::from_int16(target), heartbeat++});
}
```

## ข้อควรระวัง
- **`modbus_t` ไม่ thread-safe** — ใช้จาก thread เดียว (เช่น timer callback ตัวเดียวใน ROS2) หรือป้องกันด้วย mutex
- **ห้ามเรียกจาก callback ที่ต้องเร็ว** ถ้า timeout 200 ms แล้วอุปกรณ์ไม่ตอบ callback จะค้าง 200 ms — ใน ROS2 ให้แยก node/callback group สำหรับ Modbus
- เมื่อ read/write ล้มเหลวเพราะ timeout/สาย/ข้อมูลตอบกลับผิดรูป class จะปิด connection เอง แล้ว `ensure_connected()` ต่อใหม่ในรอบถัดไป (ไม่ถี่กว่า `retry_s`) — แต่ถ้า **อุปกรณ์ตอบ exception** (illegal address/value, busy ฯลฯ) connection ยังดี จะไม่ปิด: ถ้าปิด จะ reconnect วนทุกรอบเพราะ address เดิมก็ยังผิด
- คำสั่งเขียนใน `on_timer` ข้างบนเป็นโครงของ node ที่ผู้ใช้ออกแบบไว้แล้ว — Claude ห้ามรันโค้ดที่เขียนไปเครื่องจริงเองถ้าผู้ใช้ไม่ได้สั่ง (rules.md)
- ไม่ throw exception ออกมา → ตรวจค่า `bool` ที่คืนมาทุกครั้ง
- **RTU:** ใช้ `modbus_new_rtu("/dev/ttyUSB0", 9600, 'N', 8, 1)` แล้ว `modbus_set_slave(ctx, id)` ก่อนแต่ละ request — class ใน template เป็น TCP อย่างเดียว ถ้าต้องการ RTU ให้แยก constructor โดยใช้โครงเดียวกัน
- libmodbus ใช้ address 0-based; FC16 เขียนได้สูงสุด 123 register, FC03 อ่านได้สูงสุด 125 register ต่อครั้ง

## ทดสอบโดยไม่ต่ออุปกรณ์
```bash
python3 tools/modbus_sim.py --port 5020 --hr 100=65446 102=4464 103=1
# แล้วชี้ client ไปที่ 127.0.0.1:5020
```
