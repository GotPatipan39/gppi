---
name: flowchart
description: ใช้ก่อนเขียนหรือแก้ logic ที่มีลำดับหรือเงื่อนไข — state machine, sequence การทำงานของเครื่อง, ขั้นตอน start/stop/reset, alarm/interlock, retry/timeout, flow ที่มีหลายทางแยก (PLC, ROS2 node, Node-RED, Python, C++) — ทำ flowchart เป็นไฟล์ draw.io (.drawio) ให้ผู้ใช้ดูและรอ OK ก่อนเขียนโค้ด, อ่าน flowchart ที่ผู้ใช้แก้ใน draw.io, อัปเดต flowchart เมื่อ logic เปลี่ยน; ใช้เมื่อผู้ใช้พูดถึง flowchart, flow, draw.io, diagram, ลำดับการทำงาน
---

# Flowchart (draw.io) ก่อนเขียน logic

> เวอร์ชัน 1.2.0 — ดู [CHANGELOG.md](CHANGELOG.md)

ผู้ใช้สรุป logic เป็น flowchart ใน draw.io ก่อนเขียนโค้ดเสมอ — ให้ทั้งผู้ใช้และ Claude เห็นภาพเดียวกัน และคุยกันผ่านรูปได้
ไฟล์ `.drawio` เป็น XML: Claude เขียนเองได้ และอ่านไฟล์ที่ผู้ใช้แก้ใน draw.io กลับมาได้

## ใช้เมื่อไหร่ (rules.md)
- **ต้องทำ**: logic ที่มีลำดับหรือเงื่อนไข — state machine, sequence ของเครื่อง, start/stop/reset, alarm/interlock, retry/timeout, flow ที่มีหลายทางแยก
- **ไม่ต้องทำ**: ฟังก์ชันสั้นที่ไม่มีทางแยก (แปลงค่า register, สูตรคำนวณ), แก้บั๊กที่ไม่เปลี่ยน flow, งาน UI (ใช้ mockup ตาม skill `industrial-ui` แทน) — ไม่แน่ใจให้ถาม
- ใช้คู่กับ skill อื่นได้: flowchart บอกว่า logic **ทำอะไรตามลำดับไหน**, `tdd` พิสูจน์ว่าโค้ดทำตามนั้น, `modbus`/`ros2-humble-cpp` บอกว่าคุยกับอุปกรณ์อย่างไร

## ขั้นตอน
1. **อ่านก่อน**: `CLAUDE.md` ของโปรเจกต์ (address, timeout, ชื่อ state) และหา flowchart เดิม (`git ls-files "*.drawio*"`) — โปรเจกต์มีที่เก็บอยู่แล้ว (เช่น `docs/api/`) ให้ใช้ที่เดิมและสไตล์เดิม; ไม่มีให้ใช้ `docs/flowcharts/`; flow นี้มีไฟล์อยู่แล้วให้แก้ไฟล์เดิม ไม่สร้างซ้ำ
2. **เขียน** `<ที่เก็บ flowchart>/<ชื่อ logic>.drawio` (ไม่บีบอัด) — ข้างล่างเขียนเป็น `docs/flowcharts/` เพื่อย่อ ตามหัวข้อ "เนื้อหา" และ "รูปแบบ" ข้างล่าง
3. **ตรวจ**: `node <skill นี้>/tools/check_drawio.mjs docs/flowcharts/<ชื่อ>.drawio` — error ต้องเป็น 0; warning (กล่องทับกัน, เส้นวิ่งทับกล่อง, เส้นตัดกัน, กล่องค้าง) ให้แก้ หรืออธิบายได้ว่าตั้งใจ — ตัวตรวจดูจากพิกัดจริง แม่นกว่าการดูรูปด้วยตาซึ่งทั้งพลาดและเห็นปัญหาที่ไม่มี
4. **ดูรูปเอง** ถ้าเครื่องมี draw.io desktop (Windows: `C:\Program Files\draw.io\draw.io.exe`, Linux: `drawio`):
   `"<draw.io>" -x -f png -o <scratchpad>/<ชื่อ>.png docs/flowcharts/<ชื่อ>.drawio` แล้วเปิดรูปดู — ป้ายทับเส้น, ข้อความล้นกล่อง, อ่านยาก ให้แก้แล้ว export ใหม่ **ไม่เกิน 2 รอบ** ที่เหลือให้ผู้ใช้จัดใน draw.io
   - export ไปที่ scratchpad ไม่ใช่ในโปรเจกต์; รูปสำหรับดูเองห้ามใส่ `-e` และไม่ใช้ `--width` คู่กับ `-s`
5. **ส่งให้ผู้ใช้แล้วหยุด**: บอก path ของไฟล์ + สรุปทางแยกสำคัญเป็นข้อๆ (โดยเฉพาะทางที่หยุดเครื่อง/timeout) — **ไม่เขียนโค้ดจนผู้ใช้ OK**
   - ผู้ใช้แก้ใน draw.io แล้ว → อ่านใหม่ด้วย `check_drawio.mjs <file> --outline` (ได้ flowchart เป็นข้อความ อ่านง่ายกว่า XML และอ่านไฟล์ที่ draw.io บีบอัดได้) ก่อนทำอะไรต่อ — ไฟล์ที่ผู้ใช้แก้คือของจริง ไม่ใช่ที่ Claude เขียนไว้
6. **เขียนโค้ดตาม flowchart ที่ OK แล้ว**:
   - ชื่อ state/ขั้นในโค้ดตรงกับในรูป (`S1 CLAMP` → `S1_CLAMP`) จะได้เทียบกันได้ทีละขั้น
   - ทุกทางออกของทุกทางแยก = test อย่างน้อย 1 ตัว (skill `tdd`) — ทาง timeout/หยุดเครื่องสำคัญที่สุด
   - ระหว่างเขียนเจอว่า flow ต้องต่างจากรูป → หยุด บอกผู้ใช้ แก้ flowchart ให้ OK ก่อน ไม่เขียนโค้ดเลยรูปไป
7. **ให้ตรงกันเสมอ**: แก้ logic → แก้ flowchart ใน commit เดียวกัน (เหมือน README); เจอโค้ดกับรูปไม่ตรงกัน → ถามผู้ใช้ว่าอันไหนถูก ไม่แก้ตามอันใดอันหนึ่งเงียบๆ

## เนื้อหา — logic ที่คุมเครื่องต้องมีครบ
- **ทุกทางแยกมีทุกทางออก และมีป้าย** (ใช่/ไม่ใช่ หรือค่าเงื่อนไข) — ตัวตรวจจับข้อนี้
- **ทุกการรอมีทางออก timeout** — "รอ sensor" ที่ไม่มี timeout คือเครื่องค้างโดยไม่มี alarm
- **ทาง fault/หยุด**: output อยู่สถานะไหนเมื่อ fault (ปิดหมด? ค้างไว้?), แจ้งอะไร, กลับมาเดินได้อย่างไร (ต้อง reset? ต้องกด start ใหม่?)
- **เปิดเครื่อง / หลัง reset ไม่เดินเอง** — เริ่มที่ state ปลอดภัย รอคำสั่งใหม่
- **STOP กดได้ทุกขั้น**: วาดเป็นเหตุการณ์ (วงรีแดง) ชี้เข้า fault/stop แทนการลากเส้นจากทุกกล่อง; E-stop ทาง hardware ไม่ผ่าน logic — เขียนเป็นหมายเหตุ
- **การสื่อสารหลุด** (PLC, Modbus, ROS2 topic เงียบ) ถ้า logic อ่านค่าจากภายนอก
- **ค่า hardware** (address, timeout, ระยะ) ใช้ชื่อตัวแปร (`T_clamp`) แล้วหมายเหตุว่ามาจาก CLAUDE.md — ไม่รู้ค่าใส่ `❓` ห้ามเดา
- ไม่ต้องวาดรายละเอียดระดับบรรทัดโค้ด — 1 กล่อง = 1 ขั้นที่คนหน้างานเข้าใจ

## สไตล์ของทีม (จาก flowchart ที่ผู้ใช้วาดเองใน fg-robot-pallet `docs/api/*.drawio`)
ถ้าโปรเจกต์มี flowchart อยู่แล้ว **ทำตามสไตล์ของไฟล์เดิม** ก่อนตารางข้างล่าง — ที่ผู้ใช้ทำประจำ:
- **หัวเรื่องบนสุด** บอกชื่อ flow และไฟล์โค้ดที่เกี่ยวข้อง (`scannerTriggerWatcher.js · scanner.py · scanService.js`)
- **แถบหัวข้อคั่นช่วง** ต่อ loop/ไฟล์ (`LOOP 1 — scannerTriggerWatcher (polls every 200 ms)`) — สีตาม component
- **LEGEND** อธิบายสีตามผู้กระทำ: PLC เขียน/เราอ่าน, เราเขียน/PLC อ่าน, process ภายนอก (scanner), ทาง NG/ปฏิเสธ
- **แผง REGISTER OWNERSHIP** สำหรับ handshake กับ PLC: register ไหนฝั่งไหนเขียน ฝั่งไหนอ่านอย่างเดียว พร้อมความหมายของค่า (`D102 scan result (2 = OK, 99 = NG)`) — สำคัญมาก เพราะสองฝั่งเขียน register เดียวกัน = race
- **กล่องเหลือง "ทำไม"** บันทึกเหตุผลที่ดูแปลก/บั๊กเก่าพร้อมวันที่ (`D100 is cleared by the PLC, not by us (PLC team request, 2026-08-21)`)
- ใส่ชื่อ register/ฟังก์ชันจริงในกล่อง (`Read D100`, `waitForRobotReady('PICK')`) และ timeout จริง — ค่าจาก CLAUDE.md/`.env`/โค้ด ห้ามเดา
- จบที่กล่องผลลัพธ์ได้ (`✅ START success`, `ABORT ...`) ไม่จำเป็นต้องเป็นวงรี; ป้ายเส้นใช้ค่าจริง (`== 5`, `timeout / error`, `AbortError`)
- ภาษาตามไฟล์เดิมของโปรเจกต์

ไฟล์ที่ผู้ใช้วาดเอง: ตัวตรวจเจอ error (เช่น ทางแยกที่มีทางออกเดียว) → **บอกผู้ใช้ ไม่แก้เอง** — อาจเป็นสไตล์ที่ตั้งใจ (กล่องข้าวหลามตัดใช้เป็น "gate") หรือทางที่ลืมวาดจริง ให้ผู้ใช้ตัดสิน

## รูปแบบ
| ความหมาย | style | สี |
|---|---|---|
| เริ่ม / เหตุการณ์ (เปิดเครื่อง, กด STOP) | `ellipse;whiteSpace=wrap;html=1;` | ฟ้า `fillColor=#dae8fc;strokeColor=#6c8ebf;` (STOP แดง) |
| ขั้นตอน / state | `rounded=0;whiteSpace=wrap;html=1;` | ขาว |
| ทางแยก (คำถามที่ตอบใช่/ไม่ใช่) | `rhombus;whiteSpace=wrap;html=1;` | เหลือง `fillColor=#fff2cc;strokeColor=#d6b656;` |
| fault / หยุดเครื่อง | `rounded=0;whiteSpace=wrap;html=1;` | แดง `fillColor=#f8cecc;strokeColor=#b85450;` (เส้นที่ไปหา fault ใส่ `strokeColor=#b85450;`) |
| หมายเหตุ | `text;html=1;align=left;verticalAlign=top;whiteSpace=wrap;fontSize=11;fontColor=#666666;` | — |
| จบ (ถ้ามี) | `ellipse;...` | ฟ้า |

การวาง — เลือกตามขนาด:
- **ไม่เกิน ~15 กล่อง: กำหนดพิกัดเอง** (อ่านง่ายที่สุด แบบตัวอย่าง)
  - ทางหลักเป็นคอลัมน์เดียวจากบนลงล่าง (กล่องกว้าง 200, ห่างกันในแนวตั้ง ~40 px, พิกัดลงตัวที่ 10)
  - ทาง error/fault ออกขวา, เส้นวนกลับ (loop) ออกซ้าย — ใส่จุดหักด้วย `<Array as="points">` และจุดเข้า `entryX/entryY` ให้เส้นไม่ทับกล่องและไม่ตัดกัน (ตัวตรวจเช็กเส้นที่มีจุดหักและเส้นตรงแนวนอน/ตั้ง)
  - ถ้าหนีจุดตัดไม่ได้ (เช่น เส้นวนกลับยาวที่ต้องข้ามทางแยกกลางรูป) ใส่ `jumpStyle=arc;jumpSize=12;` ให้เส้นยาวนั้นกระโดดข้าม และย้ายป้ายเส้นที่ถูกข้ามออกจากจุดตัดด้วย `<mxGeometry x="-0.6" relative="1" as="geometry">` (ค่า -1..1 = ตำแหน่งตามเส้นจากต้นไปปลาย)
- **เกิน ~15 กล่อง: ให้ draw.io จัดวาง** (draw.io desktop ≥ 30 — เช็กด้วย `"<draw.io>" --version`): เขียน XML ตามปกติแต่ใส่ `x="0" y="0"` และไม่ใส่จุดหัก แล้ว
  `"<draw.io>" -x -f xml --layout verticalFlow -o docs/flowcharts/<ชื่อ>.drawio docs/flowcharts/<ชื่อ>.drawio`
  ได้เส้นมุมฉาก, คงสีและรูปทรงไว้ แต่ทางหลักอาจไม่ตรงเป็นแนวเดียว — ตรวจ + ดูรูป แล้วจัดเฉพาะจุดที่อ่านยาก (ห้ามใช้ `--layout` ซ้ำกับไฟล์ที่ผู้ใช้จัดตำแหน่งเองแล้ว เพราะจะทับของผู้ใช้)
- **ร่างเร็วจาก Mermaid** (draw.io ≥ 30, เมื่อผู้ใช้อยากเห็นโครงก่อน): เขียน `flowchart TD` ใน `.mmd` แล้ว `"<draw.io>" -x -f xml -o <ชื่อ>.drawio <ชื่อ>.mmd` — ได้ไฟล์ draw.io ที่จัดวางแล้ว (ภาษาไทยใช้ได้; ใส่สีด้วย `classDef`) แต่เส้นเป็นเส้นโค้ง ควบคุมตำแหน่งไม่ได้ — ลบ `.mmd` ทิ้ง เก็บแค่ `.drawio`; ห้าม export `.mmd` เป็นรูปตรงๆ
- เกิน ~20 กล่อง → แยกเป็นหลายหน้า (`<diagram>` หลายตัวในไฟล์เดียว) หรือย่อเป็นกล่อง sub-process แล้ววาดแยกหน้า

## โครงไฟล์
ตัวอย่างเต็ม (ผ่านตัวตรวจ และ export ดูแล้ว): [examples/clamp-press-cycle.drawio](examples/clamp-press-cycle.drawio) (sequence ของเครื่อง) และ [examples/modbus-poll-loop.drawio](examples/modbus-poll-loop.drawio) (poll loop ของ bridge node: reconnect + backoff, exception ไม่ตัดสาย, ใช้เส้นกระโดดข้าม)

```xml
<mxfile host="gppi">
  <diagram id="main" name="<ชื่อหน้า>">
    <mxGraphModel grid="1" gridSize="10" page="1" pageWidth="1000" pageHeight="1400">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="d_clamp" value="sensor clamp ON&lt;br&gt;ภายใน T_clamp?" style="rhombus;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;" vertex="1" parent="1">
          <mxGeometry x="280" y="580" width="200" height="90" as="geometry"/>
        </mxCell>
        <mxCell id="e_dclamp_yes" value="ใช่" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;" edge="1" parent="1" source="d_clamp" target="press">
          <mxGeometry relative="1" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```
- `id="0"` และ `id="1" parent="0"` ต้องมีเสมอ — กล่องและเส้นทั้งหมดใช้ `parent="1"` และห้ามใช้ id `0`/`1` กับกล่องหรือเส้น
- ทุกเส้นต้องมี `<mxGeometry relative="1" as="geometry"/>` และทุกกล่องต้องมี `width`/`height`
- แก้เฉพาะจุด (เปลี่ยนข้อความ, เพิ่มทางแยก) → แก้เฉพาะ cell นั้น คงพิกัดเดิมของกล่องอื่นไว้ — ผู้ใช้อาจจัดตำแหน่งเองไว้แล้ว
- id ตั้งให้อ่านออก (`d_` = ทางแยก, `e_` = เส้น) และห้ามซ้ำ
- เส้นต้องมีทั้ง `source` และ `target` — เส้นลอยไม่ติดกล่องคือ flow ที่ขาด
- ข้อความเป็น attribute ของ XML: `<` `>` `&` `"` ต้อง escape (`&lt;` ...), ขึ้นบรรทัดใหม่ใช้ `&lt;br&gt;` (เพราะ `html=1`), ตัวหนา `&lt;b&gt;...&lt;/b&gt;`
- เขียนแบบไม่บีบอัดเสมอ (diff ใน git อ่านได้); ไฟล์ที่ผู้ใช้บันทึกจาก draw.io อาจถูกบีบอัด — อ่านด้วย `--outline`

## เปิดดู / แสดงบน GitLab
- เปิดแก้: **draw.io desktop** (ใช้ offline ได้) หรือ VS Code extension **Draw.io Integration** (`hediet.vscode-drawio`) ที่เปิด `.drawio` ใน VS Code ได้เลย
- GitLab ไม่แสดง `.drawio` เป็นรูป — ถ้าจะใส่ใน README ให้ export เป็น `.drawio.svg` ที่ฝัง diagram ไว้ (แสดงเป็นรูปบน GitLab และเปิดแก้ใน draw.io ได้):
  `"<draw.io>" -x -f svg -e -o docs/flowcharts/<ชื่อ>.drawio.svg docs/flowcharts/<ชื่อ>.drawio`
  ทำเมื่อผู้ใช้ต้องการเท่านั้น (ไฟล์ใหญ่ราว 400 KB เพราะฝังฟอนต์) — ตัวตรวจอ่าน `.drawio.svg` ได้

## ห้าม
- ห้ามเขียนโค้ดก่อนผู้ใช้ OK flowchart (ยกเว้นงานที่อยู่ใน "ไม่ต้องทำ")
- ห้ามใส่ค่า hardware ที่เดาเอง
- ห้ามแก้ flowchart ที่ผู้ใช้แก้มาแล้วให้กลับเป็นแบบเดิมของ Claude — ถ้าเห็นว่าผิด (เช่น ขาดทาง timeout) ให้บอกผู้ใช้
