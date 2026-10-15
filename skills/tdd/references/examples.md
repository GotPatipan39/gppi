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
# BAD (tautological): ถ้าโค้ดลืมแปลงเป็น signed จะได้ 6552.6 (65526 × 0.1)
# และ raw * 0.1 ก็ได้ 6552.6 เหมือนกัน — test ผ่าน ทั้งที่ค่าผิด
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
// ~/.node-red/test/alarm.test.js — รันใน ~/.node-red ด้วย: node --test
// (ไม่ใส่ argument = หาไฟล์ *.test.js เองและข้าม node_modules;
//  `node --test test/` fail เพราะไม่ค้นใน directory — ทดสอบแล้วกับ Node 22.23 และ 24.21)
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
แก้ `lib/alarm.js` แล้ว Node-RED ที่รันอยู่ยังใช้โค้ดเก่า เพราะ `require` โหลดครั้งเดียวตอนเริ่ม — ต้อง restart Node-RED จึงจะได้โค้ดใหม่
**restart = หยุดทุก flow ที่คุมเครื่องอยู่** (`pm2`/`systemctl restart`) — Claude ไม่ restart เอง: บอกผู้ใช้ว่าต้อง restart แล้วให้ผู้ใช้ทำตอนเครื่องหยุดอยู่ในสถานะปลอดภัย หรือสั่งให้ทำชัดเจน (rules.md); test ข้างบนไม่ต้อง restart เพราะ `node --test` โหลดไฟล์ใหม่ทุกครั้ง

## Property-based test — ตรวจ "สิ่งที่ต้องจริงเสมอ" กับ input จำนวนมาก
test แบบตัวอย่าง (ข้างบน) ตรวจค่าที่เรานึกออก property-based test ให้ library สุ่ม input หลายร้อยชุดแล้วตรวจ **invariant** — คุ้มกับ logic ด้านความปลอดภัยที่ input มาจากภายนอก (ramp, clamp, limit, watchdog, parser) เพราะหา input แปลกๆ (NaN, ข้ามศูนย์, ค่าใหญ่มาก) ที่คนไม่ได้นึกถึง และย่อ input ที่ทำให้ fail ให้เหลือชุดเล็กที่สุดให้

- ใช้ **เพิ่ม** จาก test แบบตัวอย่าง ไม่ใช่แทน — invariant บอกว่า "ไม่เกิน limit" แต่ไม่บอกว่าค่าที่ได้ถูก
- invariant มาจาก spec/ข้อกำหนดของเครื่อง ไม่ใช่จากการอ่านโค้ด (ไม่งั้นเป็น tautological อีกแบบ)
- library ต้องติดตั้งเพิ่ม (Python `hypothesis`, JS `fast-check`) — **ถามผู้ใช้ก่อนติดตั้ง**; C++ ไม่มีใน apt ของ Ubuntu 22.04 ให้ใช้ loop + `std::mt19937` ที่ fix seed ใน gtest แทน (ไม่ดึง library ตอน build)

```python
# pytest + hypothesis
import math
from hypothesis import given, strategies as st
from drive.ramp import Ramp

MAX_STEP = 0.05  # ค่าจาก config จริงของโปรเจกต์ ห้ามเดา

# รวม NaN/inf ด้วย — input จาก network/topic เป็นได้ทุกค่า
any_float = st.floats(allow_nan=True, allow_infinity=True)

@given(st.lists(any_float, min_size=1, max_size=50))
def test_ramp_output_is_finite_and_bounded_per_step(targets):
    r = Ramp(max_step=MAX_STEP)
    prev = 0.0
    for t in targets:
        out = r.update(t)
        assert math.isfinite(out)
        assert abs(out - prev) <= MAX_STEP + 1e-9
        prev = out
```
test นี้แดง = แก้ logic ของ `Ramp` (เช่น ตรวจ `isfinite` ก่อนใช้) ไม่ใช่ตัด NaN ออกจาก strategy ให้ผ่าน — ตัดออกได้เฉพาะเมื่อมีชั้นที่กรองไว้ก่อนแล้วจริงและ test ของชั้นนั้นมีอยู่

## ลักษณะของ test ที่ดี
- ชื่อบอก **อะไร** (พฤติกรรม) ไม่ใช่ **อย่างไร** (`start_refused_while_door_open` ไม่ใช่ `calls_check_interlocks`)
- ใช้แค่ public interface และผ่านแม้ข้างในถูกเขียนใหม่
- 1 พฤติกรรมต่อ test
- ค่าที่คาดหวังเป็นตัวเลขตรงๆ ที่มาจาก datasheet/ตัวอย่างที่รู้ว่าถูก
