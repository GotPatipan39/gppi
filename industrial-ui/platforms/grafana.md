# Grafana

เหมาะกับ: dashboard ดูข้อมูลย้อนหลัง, trend, รายงาน — **ไม่เหมาะกับการสั่งงานเครื่อง** (ใช้ HMI แยก)

## Panel ที่ใช้
| ข้อมูล | panel |
|---|---|
| ค่าปัจจุบัน + เกณฑ์ | Stat (ตั้ง Thresholds + Color mode) |
| trend | Time series |
| ค่ารายอุปกรณ์ | Table หรือ Bar gauge |
| เปิด/ปิด ตามเวลา | State timeline |
| ประวัติ alarm | Table (เรียงเวลาล่าสุดก่อน) |

## ตั้งค่าที่ต้องทำทุก panel
- **Unit** (Standard options → Unit) เช่น kW, V, A, °C — ไม่เขียนหน่วยในชื่อ panel แทน
- **Decimals** ตามความละเอียดจริง
- **Thresholds**: base = สีกลาง (ไม่ใช่เขียว), เกินเกณฑ์ = สี alarm — ตามหลักใน SKILL.md
- **No value**: ตั้งเป็น `—`
- Time series: `Connect null values` = Never หรือ threshold ตามรอบเก็บข้อมูล (ไม่ลากเส้นข้ามช่วงที่ข้อมูลขาด)
- ชื่อ panel สั้น ภาษาที่คนดูใช้

## Query (PostgreSQL + JSONB แบบ data_logger)
```sql
SELECT
  ts AS "time",
  (data -> 'meter1' ->> 'kw')::numeric AS "kW"     -- ต้องถอด 2 ชั้น แล้ว cast ::numeric
FROM iot.data_logger
WHERE $__timeFilter(ts)
ORDER BY ts
```
- ใช้ `$__timeFilter(...)` เสมอ ไม่ query ทั้งตาราง
- ข้อมูลถี่และช่วงเวลายาว → รวมด้วย `$__timeGroupAlias(ts, $__interval)` + `avg()`
- ชื่อ column/key ต้องตรงกับ schema จริงของโปรเจกต์ — ดู CLAUDE.md หรือถาม

## จอห้องควบคุม
- เปิดแบบ kiosk: เติม `?kiosk` ท้าย URL dashboard (ซ่อนเมนู)
- ตั้ง refresh ตามรอบข้อมูลจริง (ไม่ถี่กว่าที่ข้อมูลเข้า)
- ใช้ theme มืด, ตัวเลข Stat ใหญ่
- ผู้ดูที่ไม่ต้อง login: เปิด anonymous access แบบ Viewer เฉพาะ org ที่มีแต่ dashboard แสดงผล

## Local เท่านั้น (`grafana.ini`)
```ini
[analytics]
reporting_enabled = false
check_for_updates = false
check_for_plugin_updates = false
[security]
disable_gravatar = true
[news]
news_feed_enabled = false
```
- plugin ติดตั้งตอน setup (ดาวน์โหลด zip แล้ววางใน plugins dir ถ้าเครื่องไม่มี internet)
