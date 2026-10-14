<!--
  โครงเริ่มต้น — ลบหัวข้อที่โปรเจกต์ไม่มี, ไม่ต้องใส่ครบทุกหัวข้อ (ดูตาราง "หัวข้อ — เลือกตามโปรเจกต์" ใน SKILL.md)
  ทุกค่าใน <...> ต้องมาจากโปรเจกต์จริง ห้ามเดา — ถ้ายังไม่รู้ ใส่ TODO(ยืนยัน)
-->
# <ชื่อโปรเจกต์>

<1 ย่อหน้า: ระบบนี้คืออะไร ใช้กับเครื่อง/อุปกรณ์อะไร สร้างด้วยอะไร (เช่น ROS 2 Humble, Node-RED, PLC รุ่น ...) และทำให้ใครทำอะไรได้>

> [!IMPORTANT]
> <สิ่งที่คนเข้าใจผิดได้ง่ายที่สุดเกี่ยวกับระบบนี้ เช่น ยังต้องพึ่งอุปกรณ์/โปรแกรมอื่นอยู่ หรือส่วนไหนที่ software ไม่ได้ทำแทน>

## Features

- **<ความสามารถ>** — <ทำอะไร ใช้ตอนไหน>
- **<ความสามารถ>** — <...>

## Safety

> [!WARNING]
> This system commands real machine motion. <สิ่งที่ต้องทำก่อนสั่งงาน เช่น ตรวจพื้นที่ว่าง, E-stop อยู่ใกล้มือ>

<พฤติกรรมที่ต้องรู้ก่อนใช้ เพราะดูจากปุ่มไม่ออก:>

- **<พฤติกรรม>** — <อธิบาย + ตัวเลขที่วัดได้ ถ้ามี>
- **<สิ่งที่ตั้งใจไม่ทำ>** — <เหตุผล / ความเสียหายที่ป้องกัน>
- **<เมื่อ software หยุดเครื่องไม่ได้>** — <ต้องทำอะไรที่หน้าเครื่อง>

## Architecture

```
<ผังระบบ ASCII: browser / node / PLC / อุปกรณ์ / port / protocol>
```

| Package / Component | Purpose |
|---|---|
| `<name>` | <...> |

- **`<node>`** — <เป็นเจ้าของอะไร, publish/expose อะไร, ทำอะไรเมื่อการเชื่อมต่อหลุด>

### How <กลไกหลัก> actually works

<อธิบายกลไกจริงครั้งเดียว แล้วโยงว่ามันอธิบายพฤติกรรมไหนบ้างที่ดูแปลก>

- **<พฤติกรรมที่ดูแปลก>** — <เป็นผลจากกลไกข้างบนอย่างไร>

## Hardware

| Device | Model | Connection | Address |
|---|---|---|---|
| <PLC / robot / sensor> | <รุ่น> | <Modbus TCP / RS-485 / USB> | <IP:port / slave ID / baud> |

## Prerequisites

- Ubuntu 22.04 with ROS 2 Humble (`<ros-humble-...>`)
- <dependency> `<version>` — <ทำไม pin เวอร์ชันนี้ / วิธีติดตั้งแบบ offline>
- <อุปกรณ์ที่ต้องเข้าถึงได้: IP:port ของ deployment นี้ และไฟล์ที่ตั้งค่า>

## Getting started

```bash
git clone <gitlab url>
cd <repo>

# 1. Build
...

# 2. Launch
...
```

Then <ขั้นตอนถัดไป>. Read [Safety](#safety) before commanding any motion.

### Running in production

```bash
<pm2 / systemd commands>
```

## Configuration

Settings live in [`<path/to/config.yaml>`](<path/to/config.yaml>). <ต้อง restart ไหม>

| Parameter | Node | Value in config | Description |
|---|---|---|---|
| `<param>` | <node> | `<ค่าจากไฟล์จริง>` | <...> |

> [!NOTE]
> **Where a setting actually comes from.** <ถ้าค่าเดียวกันตั้งได้หลายที่ บอกลำดับความสำคัญ>

## Interface

| Interface | Type | Description |
|---|---|---|
| `/<topic>` | topic `<Msg>` | <...> |

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| <อาการที่เจอหน้างาน> | <สาเหตุ + วิธีแก้> |

## Decisions

Key design decisions are recorded in [`docs/adr/`](docs/adr/):
- [0001 — <ชื่อ>](docs/adr/0001-<slug>.md)

## Project structure

```
<repo>/
├── ...
```

## Development

```bash
<คำสั่งที่ใช้ระหว่างพัฒนา>
```

> [!CAUTION]
> <สิ่งที่ทำแล้วพัง ระหว่างพัฒนาบนเครื่องที่ต่อกับเครื่องจริง>
