# ตัวอย่าง test ที่ดีและไม่ดี

ค่า hardware ในตัวอย่าง (scale, word order) เป็นค่าสมมติ — ในงานจริงเอามาจาก datasheet/CLAUDE.md ของโปรเจกต์

## C++ (gtest) — แปลง 2 register เป็น float32

```cpp
#include <gtest/gtest.h>
#include "meter/decode.hpp"

// GOOD: ค่าที่คาดหวังเป็นตัวเลขที่รู้ว่าถูก (IEEE-754: 100.0f = 0x42C80000)
TEST(DecodeFloat32, HighWordFirst) {
  EXPECT_FLOAT_EQ(decode_float32({0x42C8, 0x0000}, WordOrder::HighFirst), 100.0f);
}

TEST(DecodeFloat32, LowWordFirst) {
  EXPECT_FLOAT_EQ(decode_float32({0x0000, 0x42C8}, WordOrder::LowFirst), 100.0f);
}
```

```cpp
// BAD (tautological): สร้างค่าที่คาดหวังด้วยวิธีเดียวกับโค้ด
// ถ้าโค้ดสลับ word ผิด test นี้ก็สลับผิดตาม — ผ่านทุกครั้ง
TEST(DecodeFloat32, Works) {
  uint32_t bits = (uint32_t{0x42C8} << 16) | 0x0000;
  float expected;
  std::memcpy(&expected, &bits, sizeof expected);
  EXPECT_FLOAT_EQ(decode_float32({0x42C8, 0x0000}, WordOrder::HighFirst), expected);
}
```

## Python (pytest) — int16 มีเครื่องหมาย + scale

```python
import pytest
from meter.decode import to_signed_scaled

# GOOD: 0xFFF6 คือ -10 แบบ int16 → × 0.1 = -1.0
def test_negative_current_is_signed():
    assert to_signed_scaled(0xFFF6, scale=0.1) == pytest.approx(-1.0)

def test_positive_current():
    assert to_signed_scaled(0x000A, scale=0.1) == pytest.approx(1.0)
```

```python
# BAD (tautological): ถ้าโค้ดลืมแปลงเป็น signed จะได้ 6553.4
# และ raw * 0.1 ก็ได้ 6553.4 เหมือนกัน — test ผ่าน ทั้งที่ค่าผิด
def test_scaled():
    raw = 0xFFF6
    assert to_signed_scaled(raw, scale=0.1) == pytest.approx(raw * 0.1)
```

## Python — state machine และ interlock

```python
from machine.state import Machine, Event, State

# GOOD: ตรวจผ่าน public interface — refactor ข้างในได้โดย test ไม่พัง
def test_start_refused_while_door_open():
    m = Machine()
    m.on_event(Event.DOOR_OPEN)
    m.on_event(Event.START)
    assert m.state == State.IDLE
    assert m.last_fault == "door_open"
```

```python
# BAD (ผูกกับ implementation): อ่านตัวแปร private และตรวจว่า method ภายในถูกเรียก
def test_start_refused_while_door_open(mocker):
    m = Machine()
    spy = mocker.spy(m, "_check_interlocks")
    m._door_open = True
    m.on_event(Event.START)
    spy.assert_called_once()
    assert m._state == "idle"
```

## JS (Node-RED) — แยก logic ออกจาก function node

โค้ดใน function node test ตรงๆ ไม่ได้ ให้ย้าย logic ไปไว้ในไฟล์ `.js` แล้วให้ function node เรียกใช้

```js
// ~/.node-red/lib/alarm.js
function levelFor(value, limits) {
  if (value >= limits.highHigh) return 'alarm';
  if (value >= limits.high) return 'warning';
  return 'normal';
}
module.exports = { levelFor };
```

```js
// ~/.node-red/settings.js
functionGlobalContext: {
  alarm: require('./lib/alarm.js'),
},

// ใน function node
const { levelFor } = global.get('alarm');
msg.level = levelFor(msg.payload, flow.get('limits'));
return msg;
```

```js
// ~/.node-red/test/alarm.test.js — รันด้วย: node --test test/
const test = require('node:test');
const assert = require('node:assert/strict');
const { levelFor } = require('../lib/alarm.js');

// GOOD: ขอบพอดีเป็นจุดที่บั๊กบ่อย (>= กับ >)
test('ถึงค่า high พอดีเป็น warning', () => {
  assert.equal(levelFor(80, { high: 80, highHigh: 95 }), 'warning');
});

test('ต่ำกว่า high เป็น normal', () => {
  assert.equal(levelFor(79.9, { high: 80, highHigh: 95 }), 'normal');
});
```
แก้ `lib/alarm.js` แล้วต้อง restart Node-RED เพราะ `require` โหลดครั้งเดียวตอนเริ่ม

## ลักษณะของ test ที่ดี
- ชื่อบอก **อะไร** (พฤติกรรม) ไม่ใช่ **อย่างไร** (`start_refused_while_door_open` ไม่ใช่ `calls_check_interlocks`)
- ใช้แค่ public interface และผ่านแม้ข้างในถูกเขียนใหม่
- 1 พฤติกรรมต่อ test
- ค่าที่คาดหวังเป็นตัวเลขตรงๆ ที่มาจาก datasheet/ตัวอย่างที่รู้ว่าถูก
