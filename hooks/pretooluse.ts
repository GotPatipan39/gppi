// PreToolUse hook: อ่าน JSON จาก stdin แล้วตอบ ask ตาม logic ใน gppi.ts (ตัวเดียวกับ mod)
// รันด้วย node ≥ 22.18 (รัน .ts ได้เองโดยไม่ต้อง build)
// อ่าน input ไม่ออก → ถาม แทนการปล่อยผ่าน (matcher ใน hooks.json จำกัดไว้แค่ Bash|PowerShell)
// node รันไฟล์นี้ไม่ได้เลย (ไม่มี/เก่า/import ล้ม) → exit ≠ 0 → คำสั่งใน hooks.json ต่อด้วย `|| exit 2` บล็อกไว้ (fail-closed)
import { preToolUseDecision } from './gppi.ts'

const FALLBACK = {
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'ask',
    permissionDecisionReason: 'gppi: ตัวตรวจคำสั่งทำงานผิดพลาด จึงขอให้ผู้ใช้ยืนยันแทน',
  },
}

// เขียนคำตอบครั้งเดียว — JSON สองก้อนต่อกันจะ parse ไม่ได้และกลายเป็นไม่ตัดสิน
let answered = false
const answer = (out: object | undefined) => {
  if (answered) return
  answered = true
  if (out) process.stdout.write(JSON.stringify(out))
}

let raw = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', chunk => { raw += chunk })
process.stdin.on('error', () => answer(FALLBACK))
process.stdin.on('end', () => {
  try {
    answer(preToolUseDecision(JSON.parse(raw)))
  } catch {
    answer(FALLBACK)
  }
})
