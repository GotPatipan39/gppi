# Node-RED ด้วย node-red-contrib-modbus

## โครง flow ที่ใช้
- **แยกการ poll ออกจากการบันทึก:** flow หนึ่ง poll อุปกรณ์ต่อเนื่องแล้วเก็บค่าล่าสุดไว้ใน `flow` context, อีก flow ใช้ inject ตามเวลาเพื่อรวมค่าแล้วเขียนลง database (เช่น PostgreSQL ผ่าน `node-red-contrib-postgresql` + `msg.params`)
- **1 พอร์ต serial = 1 Modbus client config** ทุก node ที่ใช้บัสเดียวกันต้องชี้ไป config เดียวกัน ห้ามสร้าง config ซ้ำสำหรับพอร์ตเดียวกัน (จะแย่งพอร์ตกัน)
- หลายอุปกรณ์บนบัสเดียว: ใช้ **Modbus-Flex-Getter** แล้วส่ง unit ID มากับ msg แทนการสร้าง client หลายตัว

## Modbus-Flex-Getter
input:
```javascript
msg.payload = { fc: 3, unitid: 80, address: 17, quantity: 1 };
return msg;
```
output: `msg.payload` เป็น array ของค่า register และ `msg.responseBuffer.buffer` เป็น Buffer ดิบ

## ถอดค่าใน function node
```javascript
const buf = msg.responseBuffer.buffer;

const f32_abcd = buf.readFloatBE(0);                         // ABCD
const i16      = buf.readInt16BE(0);                         // int16 ติดลบ
const u32_abcd = buf.readUInt32BE(0);
// CDAB (low word ก่อน เช่น Mitsubishi): สลับ word ก่อน
const sw = Buffer.from([buf[2], buf[3], buf[0], buf[1]]);
const i32_cdab = sw.readInt32BE(0);

msg.payload = { value: f32_abcd };
return msg;
```
- ค่าที่ต้อง scale (เช่น ÷10, ÷100) ให้ทำใน function node และใส่คอมเมนต์หน่วย
- เก็บค่าล่าสุดพร้อมเวลา: `flow.set("dev80", { value, ts: Date.now() })` แล้วฝั่งบันทึกตรวจว่าค่าเก่าเกินไปหรือไม่ก่อนเขียน

## ปัญหาที่พบบ่อย
| อาการ | สาเหตุ |
|---|---|
| สถานะค้าง "queueing" / "timeout" สลับกัน | poll ถี่เกินกว่าที่บัสทำทัน หรือหลาย node ยิงพร้อมกัน → เพิ่ม interval หรือรวมเป็นบล็อก |
| อ่านได้บ้างไม่ได้บ้าง | มี client config ซ้ำบนพอร์ตเดียวกัน, ไม่มี termination |
| ค่าเพี้ยนมาก | word order ผิด หรือ address คลาด 1 |
