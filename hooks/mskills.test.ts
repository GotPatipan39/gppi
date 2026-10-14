import { test, expect } from 'claude-code/testing'
import { isRiskyGit } from './mskills'

const RISKY = [
  'git push',
  'git push origin main',
  'git -C D:/ws/mskills push',
  'git -C "C:/Users/Got Automation/x" push origin main',
  'cd /d/ws/mskills && git push -u origin plugin-trial',
  'git reset --hard HEAD~1',
  'git clean -fd',
  'git branch -D old',
  'git branch --force -D old',
  'git checkout -- src/a.cpp',
  'git checkout .',
  'git restore src/a.cpp',
]
const SAFE = [
  'git status',
  'git log --oneline -5',
  'git diff --staged',
  'git commit -m "fix"',
  'git reset --soft HEAD~1',
  'git branch -d merged',
  'git checkout -b feature',
  'git checkout main',
  'echo push',
  'ls pushd',
]

test('จับคำสั่ง git อันตรายได้ครบ', () => {
  for (const c of RISKY) expect(isRiskyGit(c)).toBe(true)
})

test('ไม่ถามคำสั่ง git ที่ไม่อันตราย', () => {
  for (const c of SAFE) expect(isRiskyGit(c)).toBe(false)
})

test('Bash/PowerShell: git push → ask, git status → ตามเดิม', async ($, on) => {
  on('tool.check', () => ({ decision: 'allow' }))
  for (const tool of ['Bash', 'PowerShell']) {
    expect((await $.tool.check({ tool, input: { command: 'git push origin main' } })).decision).toBe('ask')
    expect((await $.tool.check({ tool, input: { command: 'git status' } })).decision).toBe('allow')
  }
})

test('ไม่ผ่อน deny ที่ engine ตัดสินไว้', async ($, on) => {
  on('tool.check', () => ({ decision: 'deny', reason: 'blocked' }))
  expect((await $.tool.check({ tool: 'Bash', input: { command: 'git push' } })).decision).toBe('deny')
})
