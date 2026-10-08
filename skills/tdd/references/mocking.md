# mock ตรงไหน

mock **ที่ขอบระบบเท่านั้น** — ของที่เราคุมไม่ได้ หรือแตะแล้วอันตราย:
- **hardware**: Modbus RTU/TCP, PLC, serial/RS-485, servo drive, encoder, CAN, GPIO — ห้ามแตะของจริงใน test เด็ดขาด
- **เวลา**: `now()`, timer, `sleep` — inject นาฬิกาแทน test จะเร็วและผลเหมือนเดิมทุกครั้ง
- network/API ภายนอก, database (ถ้าทำได้ใช้ DB สำหรับ test แทน), file system (บางกรณี)

ไม่ mock:
- class/module ของเราเอง
- ส่วนประกอบภายในที่เราคุมได้

## ออกแบบให้ mock ได้: ส่งของภายนอกเข้ามา ไม่สร้างเองข้างใน

```python
# mock ได้: รับ client เข้ามา
class MeterPoller:
    def __init__(self, client, now):
        self.client = client
        self.now = now

# mock ยาก: เปิด port จริงข้างใน test แล้วต้องมีอุปกรณ์ต่ออยู่
class MeterPoller:
    def __init__(self):
        self.client = ModbusSerialClient(port="/dev/ttyUSB0")
```

```cpp
// C++: interface เล็กๆ ที่ขอบ hardware
class RegisterReader {
 public:
  virtual ~RegisterReader() = default;
  virtual std::optional<std::vector<uint16_t>> read_holding(int addr, int count) = 0;
};
// โค้ดจริงใช้ LibmodbusReader, test ใช้ FakeReader — logic ไม่รู้ว่าเป็นตัวไหน
```

## fake อุปกรณ์ที่จำลองความผิดพลาดได้
test สำคัญที่สุดของงานเครื่องจักรมักเป็นตอนอุปกรณ์ **ไม่ตอบ** — fake ต้องทำให้เกิดได้

```python
class FakeModbus:
    def __init__(self, regs):
        self.regs = dict(regs)
        self.fail = False

    def read_holding(self, addr, count):
        if self.fail:
            raise TimeoutError("no response")
        return [self.regs[a] for a in range(addr, addr + count)]
```

ถ้ามีหลายอุปกรณ์ ทำ adapter รายอุปกรณ์ที่มี function เฉพาะ (`meter.read_voltage()`, `drive.set_speed(rpm)`) แล้ว fake ที่ระดับนั้น
ดีกว่า fake ตัวกลาง `read(addr, count)` ตัวเดียวที่ต้องมี if ตาม address อยู่ใน test

## นาฬิกาปลอมสำหรับ timeout / watchdog

```python
class FakeClock:
    def __init__(self, t=0.0):
        self.t = t
    def now(self):
        return self.t
    def advance(self, dt):
        self.t += dt

def test_watchdog_expires_after_timeout():
    clock = FakeClock()
    wd = Watchdog(timeout_s=0.5, now=clock.now)  # ใช้ค่าเดียวกับ config จริงของโปรเจกต์
    wd.feed()
    clock.advance(0.49)
    assert not wd.expired()
    clock.advance(0.02)
    assert wd.expired()
```
ถ้า test แบบนี้แดง ให้แก้ logic ของ watchdog — ไม่เพิ่ม timeout ให้ผ่าน

## ROS2
แยก logic ออกจาก node เป็น class ธรรมดาที่ไม่รู้จัก `rclcpp` แล้ว test class นั้นตรงๆ ด้วย gtest — node เหลือแค่รับ/ส่ง message
ส่วน test ระดับ node, launch_testing และ `mock_components` ของ ros2_control ดู skill `ros2-humble-cpp` (`references/testing.md`)
