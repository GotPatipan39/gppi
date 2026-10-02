#!/usr/bin/env python3
"""Modbus TCP simulator สำหรับทดสอบโค้ดโดยไม่ต้องต่อ PLC/อุปกรณ์จริง

ติดตั้ง:  pip install "pymodbus>=3.10,<4"   (ทดสอบกับ 3.15 — v4 จะเปลี่ยน API ของ datastore)
รัน:      python3 modbus_sim.py --port 5020
          python3 modbus_sim.py --port 5020 --hr 0=100 1=-90 10=1234

- holding register, input register, coil, discrete input ที่ address 0..9999 เริ่มเป็น 0 ทั้งหมด
- address ที่ใส่ใน --hr / --co เป็นแบบ 0-based เหมือนที่ใช้ใน libmodbus/pymodbus
- ค่าติดลบใน --hr จะถูกแปลงเป็น int16 ให้อัตโนมัติ
- ใช้ port 5020 แทน 502 เพื่อไม่ต้องใช้สิทธิ์ root
- รองรับทุก device_id (unit id)
- ดูค่าที่ client เขียนเข้ามา: อ่านกลับด้วย client อีกตัว เช่น  mbpoll -m tcp -p 5020 -a 1 -r 1 -c 10 127.0.0.1
"""
import argparse
import asyncio
import logging
import warnings

from pymodbus.datastore import (ModbusDeviceContext, ModbusSequentialDataBlock,
                                ModbusServerContext)
from pymodbus.server import StartAsyncTcpServer

SIZE = 10000


def parse_pairs(pairs):
    out = {}
    for p in pairs or []:
        a, v = p.split("=")
        out[int(a)] = int(v) & 0xFFFF
    return out


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=5020)
    ap.add_argument("--hr", nargs="*", help="holding register เริ่มต้น เช่น 0=100 1=-90")
    ap.add_argument("--co", nargs="*", help="coil เริ่มต้น เช่น 0=1")
    a = ap.parse_args()

    hr = [0] * SIZE
    for k, v in parse_pairs(a.hr).items():
        hr[k] = v
    co = [0] * SIZE
    for k, v in parse_pairs(a.co).items():
        co[k] = 1 if v else 0

    # pymodbus ใช้ address ภายในแบบ 1-based: block ที่เริ่ม 1 คือ address 0 ของ client
    device = ModbusDeviceContext(
        hr=ModbusSequentialDataBlock(1, hr),
        co=ModbusSequentialDataBlock(1, co),
        ir=ModbusSequentialDataBlock(1, [0] * SIZE),
        di=ModbusSequentialDataBlock(1, [0] * SIZE),
    )
    ctx = ModbusServerContext(devices=device, single=True)
    logging.info("Modbus TCP simulator on %s:%d", a.host, a.port)
    await StartAsyncTcpServer(context=ctx, address=(a.host, a.port))


if __name__ == "__main__":
    warnings.filterwarnings("ignore", category=DeprecationWarning)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    asyncio.run(main())
