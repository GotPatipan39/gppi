import type { Register } from 'claude-code'

// คำสั่ง git ที่ย้อนกลับยาก — ให้ผู้ใช้ยืนยันก่อน (แทนกฎ ask ใน settings.json ที่ plugin ส่งไม่ได้)
// จับทั้ง `git push` และ `git -C <path> push`; เจอคำว่า push ในข้อความอื่นที่ขึ้นต้นด้วย git แล้วถามเกิน ยังปลอดภัยกว่าหลุด
// กฎ (rules.md) ส่งผ่าน SessionStart ใน hooks.json แทน prompt.compose — Claude Code 2.1.296 ไม่ให้ plugin ของผู้ใช้แก้ system prompt
const GIT = String.raw`(?:^|[;&|\n(]\s*)git\b[^;&|\n]*?\s`
const RISKY_GIT: readonly RegExp[] = [
  new RegExp(GIT + String.raw`push\b`),
  new RegExp(GIT + String.raw`reset\s+--hard\b`),
  new RegExp(GIT + String.raw`clean\b`),
  new RegExp(GIT + String.raw`branch\s+(?:\S+\s+)*-D\b`),
  new RegExp(GIT + String.raw`checkout\s+(?:--|\.)(?:\s|$)`),
  new RegExp(GIT + String.raw`restore\b`),
]

export const isRiskyGit = (command: string): boolean => RISKY_GIT.some(r => r.test(command))

export const register: Register = on => {
  for (const tool of ['Bash', 'PowerShell']) {
    on('tool.check', { tool }, async ($, e, next) => {
      const verdict = await next(e)
      if (verdict.decision === 'deny') return verdict
      const command = (e.input as { command?: unknown }).command
      return typeof command === 'string' && isRiskyGit(command)
        ? { decision: 'ask', reason: 'mskills: คำสั่ง git ที่ย้อนกลับยาก ต้องให้ผู้ใช้ยืนยัน' }
        : verdict
    }).catch(() => ({ decision: 'ask', reason: 'mskills: ตัวตรวจคำสั่ง git ทำงานผิดพลาด จึงขอให้ผู้ใช้ยืนยันแทน' }))
  }
}
