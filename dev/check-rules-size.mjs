#!/usr/bin/env node
// ไฟล์ที่ SessionStart hook ส่งเข้า session ต้องสั้นกว่าเพดานของ Claude Code
// เกิน 10,000 ตัวอักษร → Claude Code บันทึกเป็นไฟล์แล้วส่งแค่ตัวอย่าง 2KB แรก = กฎความปลอดภัยท้ายไฟล์หายเงียบๆ
// (เจอ 2026-11-27: rules.md 10,822 ตัวอักษร ทำให้ eval suggest-questionnaire ตก 0/3)
//   node dev/check-rules-size.mjs        — error = exit 1
import { readFileSync } from 'node:fs'

const LIMIT = 10000
const WARN = 9000 // เผื่อที่ให้แก้ครั้งต่อไป
const files = ['rules.md', 'rules-skills.md']
let failed = false
for (const f of files) {
  const n = readFileSync(new URL('../' + f, import.meta.url), 'utf8').length
  const status = n >= LIMIT ? 'ERROR' : n >= WARN ? 'WARN ' : 'OK   '
  console.log(`${status} ${f}: ${n} ตัวอักษร (เพดาน ${LIMIT}, เตือนที่ ${WARN})`)
  if (n >= WARN) failed = true
}
if (failed) {
  console.log('ย่อข้อความ หรือย้ายส่วนที่ไม่ต้องใช้ทุก session ไปไว้ใน skill/docs — ห้ามปล่อยให้ถึงเพดาน')
  process.exit(1)
}
