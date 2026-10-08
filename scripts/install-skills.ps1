<#
.SYNOPSIS
  copy skill จาก D:\ws\mskills ไปให้ Claude Code (VS Code) ใช้

.EXAMPLE
  # 1) ติดตั้ง skill ทั่วไป (grilling ฯลฯ) ให้ใช้ได้ทุกโปรเจกต์ — ทำครั้งเดียว / ทำซ้ำเมื่อ skill อัปเดต
  .\install-skills.ps1

.EXAMPLE
  # 2) ติดตั้ง skill ให้โปรเจกต์เดียว
  .\install-skills.ps1 -Project D:\ws\fg-robot-pallet -Skills ros2-humble-cpp,modbus,industrial-ui

.EXAMPLE
  # 3) ติดตั้งทุก skill (ไม่ใส่ -Project = ใช้ได้ทุกโปรเจกต์)
  .\install-skills.ps1 -All

.EXAMPLE
  # ดูว่าจะ copy อะไรโดยยังไม่ copy จริง
  .\install-skills.ps1 -Project D:\ws\fg-robot-pallet -Skills modbus -WhatIf

.NOTES
  ถ้ารันไม่ได้เพราะ execution policy ให้รันแบบนี้แทน:
    powershell -ExecutionPolicy Bypass -File D:\ws\mskills\scripts\install-skills.ps1
  หา skill จาก skills\<ชื่อ> (ของเราเอง) และ vendor\<ที่มา>\<ชื่อ> (จากภายนอก) — ปลายทางใช้แค่ <ชื่อ>
  skill จาก vendor จะได้ vendor\<ที่มา>\LICENSE copy ไปเป็น LICENSE ในโฟลเดอร์ skill ด้วย
  skill ที่ต้องใช้คู่กัน (เช่น grill-me ต้องมี grilling) จะถูก copy ให้อัตโนมัติ
  copy ทับของเดิม แต่ไม่ลบไฟล์ที่มีอยู่แล้วในปลายทาง
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
  # โฟลเดอร์โปรเจกต์ — ไม่ใส่ = ติดตั้งแบบใช้ได้ทุกโปรเจกต์ ($HOME\.claude\skills)
  [string]$Project,
  # ชื่อ skill — ไม่ใส่ = ใช้ชุดทั่วไป ($GlobalDefault)
  [string[]]$Skills,
  # เลือกโฟลเดอร์โปรเจกต์จากหน้าต่าง และเลือก skill จากเมนู (ใช้กับ install-to-project.bat)
  [switch]$Pick,
  # ติดตั้งทุก skill ที่มีใน skills\ และ vendor\
  [switch]$All
)

$ErrorActionPreference = 'Stop'
# root ของ repo (script อยู่ใน scripts\)
$Source = Split-Path $PSScriptRoot -Parent

# skill ที่ใช้ได้กับทุกโปรเจกต์
$GlobalDefault = @('grilling', 'grill-me', 'domain-modeling', 'grill-with-docs', 'project-readme', 'git-commit', 'tdd')

# skill ที่ต้องใช้คู่กัน
$Requires = @{
  'grill-me'        = @('grilling')
  'grill-with-docs' = @('grilling', 'domain-modeling')
}

# ชื่อ skill → @{ Dir = โฟลเดอร์ต้นทาง; License = LICENSE ของ vendor หรือ $null }
function Get-SkillMap {
  $found = @()
  $own = Join-Path $Source 'skills'
  if (Test-Path -LiteralPath $own) {
    $found += @(Get-ChildItem -LiteralPath $own -Directory | ForEach-Object { @{ D = $_; L = $null } })
  }
  $vendor = Join-Path $Source 'vendor'
  if (Test-Path -LiteralPath $vendor) {
    foreach ($v in (Get-ChildItem -LiteralPath $vendor -Directory)) {
      $lic = Join-Path $v.FullName 'LICENSE'
      if (-not (Test-Path -LiteralPath $lic)) { $lic = $null }
      $found += @(Get-ChildItem -LiteralPath $v.FullName -Directory | ForEach-Object { @{ D = $_; L = $lic } })
    }
  }
  $map = @{}
  foreach ($f in $found) {
    $d = $f.D
    if ($d.Name.StartsWith('_') -or -not (Test-Path -LiteralPath (Join-Path $d.FullName 'SKILL.md'))) { continue }
    if ($map.ContainsKey($d.Name)) {
      throw "skill ชื่อซ้ำ: $($d.Name)`n  $($map[$d.Name].Dir)`n  $($d.FullName)"
    }
    $map[$d.Name] = @{ Dir = $d.FullName; License = $f.L }
  }
  $map
}
$SkillMap = Get-SkillMap
$AllNames = @($SkillMap.Keys | Sort-Object)
if ($All) { $Skills = $AllNames }

# ---- โหมดเลือกเอง (ดับเบิลคลิก install-to-project.bat) ----
if ($Pick) {
  if (-not $Project) {
    Add-Type -AssemblyName System.Windows.Forms
    $dlg = New-Object System.Windows.Forms.FolderBrowserDialog
    $dlg.Description = 'เลือกโฟลเดอร์โปรเจกต์ที่จะติดตั้ง skill'
    if (Test-Path -LiteralPath 'D:\ws') { $dlg.SelectedPath = 'D:\ws' }
    if ($dlg.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) {
      Write-Host 'ยกเลิก — ยังไม่ได้ติดตั้งอะไร'
      return
    }
    $Project = $dlg.SelectedPath
  }
  $list = $AllNames
  Write-Host "โปรเจกต์: $Project"
  Write-Host ''
  for ($i = 0; $i -lt $list.Count; $i++) {
    $v = (Select-String -LiteralPath (Join-Path $SkillMap[$list[$i]].Dir 'SKILL.md') -Pattern 'เวอร์ชัน\s+([0-9.]+)' -List |
      ForEach-Object { $_.Matches[0].Groups[1].Value })
    $vt = if ($v) { "  ($v)" } else { '' }
    Write-Host ("  {0,2}. {1}{2}" -f ($i + 1), $list[$i], $vt)
  }
  Write-Host ''
  $ans = Read-Host 'พิมพ์หมายเลข skill ที่ต้องการ คั่นด้วย , (เช่น 1,4,6) หรือพิมพ์ all เพื่อเลือกทั้งหมด แล้วกด Enter'
  $picked = New-Object System.Collections.Generic.List[string]
  if ($ans.Trim() -match '^(all|a|ทั้งหมด)$') { foreach ($x in $list) { $picked.Add($x) }; $ans = '' }
  foreach ($tok in ($ans -split '[,\s]+' | Where-Object { $_ })) {
    $n = 0
    if (-not [int]::TryParse($tok, [ref]$n) -or $n -lt 1 -or $n -gt $list.Count) {
      throw "หมายเลขไม่ถูกต้อง: $tok (ต้องอยู่ระหว่าง 1-$($list.Count))"
    }
    if (-not $picked.Contains($list[$n - 1])) { $picked.Add($list[$n - 1]) }
  }
  if ($picked.Count -eq 0) { Write-Host 'ไม่ได้เลือก skill — ยังไม่ได้ติดตั้งอะไร'; return }
  $Skills = $picked.ToArray()
  Write-Host ''
}

# ---- ปลายทาง ----
if ($Project) {
  if (-not (Test-Path -LiteralPath $Project -PathType Container)) {
    throw "ไม่พบโฟลเดอร์โปรเจกต์: $Project"
  }
  $Target = Join-Path (Join-Path $Project '.claude') 'skills'
} else {
  $Target = Join-Path (Join-Path $HOME '.claude') 'skills'
}

# ---- รายชื่อ skill + ตัวที่ต้องใช้คู่กัน ----
if (-not $Skills -or $Skills.Count -eq 0) { $Skills = $GlobalDefault }
$Skills = @($Skills | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })

$toCopy = New-Object System.Collections.Generic.List[string]
foreach ($s in $Skills) {
  if ($Requires.ContainsKey($s)) {
    foreach ($d in $Requires[$s]) { if (-not $toCopy.Contains($d)) { $toCopy.Add($d) } }
  }
  if (-not $toCopy.Contains($s)) { $toCopy.Add($s) }
}

# ---- ตรวจว่ามีครบก่อน copy ----
$missing = @($toCopy | Where-Object { -not $SkillMap.ContainsKey($_) })
if ($missing.Count -gt 0) {
  throw "ไม่พบ skill: $($missing -join ', ')`nที่มีอยู่: $($AllNames -join ', ')"
}

# ---- copy ----
Write-Host "ปลายทาง: $Target"
if ($PSCmdlet.ShouldProcess($Target, 'สร้างโฟลเดอร์')) {
  New-Item -ItemType Directory -Force -Path $Target | Out-Null
}
foreach ($s in $toCopy) {
  $src = $SkillMap[$s].Dir
  $lic = $SkillMap[$s].License
  $dst = Join-Path $Target $s
  $ver = (Select-String -LiteralPath (Join-Path $src 'SKILL.md') -Pattern 'เวอร์ชัน\s+([0-9.]+)' -List |
    ForEach-Object { $_.Matches[0].Groups[1].Value })
  $label = if ($ver) { "$s ($ver)" } else { $s }
  if ($PSCmdlet.ShouldProcess($dst, "copy $label")) {
    New-Item -ItemType Directory -Force -Path $dst | Out-Null
    Copy-Item -Path (Join-Path $src '*') -Destination $dst -Recurse -Force
    if ($lic) { Copy-Item -LiteralPath $lic -Destination (Join-Path $dst 'LICENSE') -Force }
    Write-Host "  ✓ $label"
  }
}
# ---- CLAUDE.md ระดับเครื่อง (เฉพาะการติดตั้งแบบทุกโปรเจกต์) ----
# ใส่เนื้อหาไว้ระหว่าง marker — เนื้อหาอื่นในไฟล์ที่ผู้ใช้เขียนเองจะไม่ถูกแตะ
$globalSrc = Join-Path (Join-Path $Source 'config') 'global-CLAUDE.md'
if (-not $Project -and (Test-Path -LiteralPath $globalSrc)) {
  $claudeMd = Join-Path (Split-Path $Target -Parent) 'CLAUDE.md'
  $begin = '<!-- BEGIN claude-skills (จัดการโดย install-skills — อย่าแก้ในบล็อกนี้) -->'
  $end   = '<!-- END claude-skills -->'
  $block = $begin + "`n" + ([System.IO.File]::ReadAllText($globalSrc, [System.Text.Encoding]::UTF8)).Replace('{{SKILLS_DIR}}', $Source).TrimEnd() + "`n" + $end
  $old = ''
  if (Test-Path -LiteralPath $claudeMd) { $old = [System.IO.File]::ReadAllText($claudeMd, [System.Text.Encoding]::UTF8) }
  $bi = $old.IndexOf('<!-- BEGIN claude-skills'); $ei = $old.IndexOf($end)
  if ($bi -ge 0 -and $ei -gt $bi) {
    $new = $old.Substring(0, $bi) + $block + $old.Substring($ei + $end.Length)
    $how = 'อัปเดตบล็อกเดิม'
  } elseif ($old.Trim().Length -gt 0) {
    $new = $old.TrimEnd() + "`n`n" + $block + "`n"
    $how = 'เพิ่มต่อท้าย (เนื้อหาเดิมยังอยู่)'
  } else {
    $new = $block + "`n"
    $how = 'สร้างใหม่'
  }
  if ($PSCmdlet.ShouldProcess($claudeMd, "CLAUDE.md: $how")) {
    [System.IO.File]::WriteAllText($claudeMd, $new, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host "  ✓ CLAUDE.md ($how) — $claudeMd"
  }
}

# ---- permissions ระดับเครื่อง (เฉพาะการติดตั้งแบบทุกโปรเจกต์) ----
# เพิ่มกฎใน config\permissions.json ที่ settings.json ยังไม่มี — ไม่ลบ/แก้ค่าอื่น, ไม่มีอะไรใหม่ = ไม่เขียนไฟล์
$permSrc = Join-Path (Join-Path $Source 'config') 'permissions.json'
if (-not $Project -and (Test-Path -LiteralPath $permSrc)) {
  $settingsPath = Join-Path (Split-Path $Target -Parent) 'settings.json'
  $want = ([System.IO.File]::ReadAllText($permSrc, [System.Text.Encoding]::UTF8) | ConvertFrom-Json).permissions
  $cur = $null
  if (Test-Path -LiteralPath $settingsPath) {
    try { $cur = [System.IO.File]::ReadAllText($settingsPath, [System.Text.Encoding]::UTF8) | ConvertFrom-Json }
    catch { Write-Warning "settings.json อ่านไม่ได้ (JSON ไม่ถูกต้อง) — ข้าม ไม่แตะไฟล์: $settingsPath"; $cur = 'invalid' }
  }
  if ($cur -ne 'invalid') {
    if ($null -eq $cur) { $cur = New-Object PSObject }
    if (-not $cur.PSObject.Properties['permissions']) { $cur | Add-Member -NotePropertyName permissions -NotePropertyValue (New-Object PSObject) }
    $added = 0
    foreach ($kind in @('allow', 'ask', 'deny')) {
      if (-not $want.PSObject.Properties[$kind]) { continue }
      $have = @()
      if ($cur.permissions.PSObject.Properties[$kind]) { $have = @($cur.permissions.$kind) }
      # -cnotcontains: กฎแยกตัวพิมพ์เล็ก/ใหญ่ (branch -D ≠ branch -d)
      $new = @($want.$kind | Where-Object { $have -cnotcontains $_ })
      if ($new.Count -eq 0) { continue }
      $added += $new.Count
      $merged = @($have) + $new
      if ($cur.permissions.PSObject.Properties[$kind]) { $cur.permissions.$kind = $merged }
      else { $cur.permissions | Add-Member -NotePropertyName $kind -NotePropertyValue $merged }
    }
    if ($added -eq 0) {
      Write-Host "  ✓ settings.json (กฎครบแล้ว ไม่ได้แก้ไฟล์)"
    } elseif ($PSCmdlet.ShouldProcess($settingsPath, "settings.json: เพิ่มกฎ $added ข้อ")) {
      $json = ConvertTo-Json -InputObject $cur -Depth 50
      [System.IO.File]::WriteAllText($settingsPath, $json + "`n", (New-Object System.Text.UTF8Encoding($false)))
      Write-Host "  ✓ settings.json (เพิ่มกฎ $added ข้อ) — $settingsPath"
    }
  }
}

if (-not $WhatIfPreference) {
  Write-Host ""
  Write-Host "เสร็จแล้ว — ใน VS Code กด Ctrl+Shift+P > Developer: Reload Window แล้วพิมพ์ / เพื่อดูรายการ skill"
}
