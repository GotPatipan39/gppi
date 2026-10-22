---
max_turns: 8
allowed_tools: [Read, Glob, Grep, Skill]
tags: [positive, behavior]
---

แผนที่ตกลงกันแล้ว: AGV ล้อแบบ diff drive คุมผ่าน ROS2 Humble ส่งคำสั่งความเร็วไปที่ servo drive ผ่าน Modbus RTU, รับภารกิจจาก PLC (FX5) ผ่าน Modbus TCP ว่าให้ไปสถานี A หรือ B, มี HMI บน Node-RED แสดงสถานะ — โปรเจกต์ยังไม่มีโค้ดและไม่มี simulator ช่วยแตกเป็น ticket ให้หน่อย (ยังไม่ต้องเขียนไฟล์ แสดงรายการก่อน)
