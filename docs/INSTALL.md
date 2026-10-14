# ติดตั้ง gppi ทีละขั้น

คู่มือนี้พาจากเครื่องเปล่าจนตัวกันคำสั่งทำงาน — ทำตามลำดับ ไม่ต้องข้ามไปอ่านที่อื่น
ขั้นตอนฝั่ง Windows ทดสอบแล้วบนเครื่องจริง (2026-10-14, Claude Code 2.1.296) — ฝั่ง WSL ยังไม่ได้ทดสอบ ถ้าติดตรงไหนแจ้งเจ้าของ repo

> [!IMPORTANT]
> **Windows กับ WSL เป็นคนละเครื่องในมุมของ Claude Code** (`~/.claude` แยกกัน) — ใช้ Claude Code ฝั่งไหน ต้องติดตั้งฝั่งนั้น ใช้ทั้งสองฝั่งก็ทำทั้งสองรอบ
> VS Code extension กับ CLI บนฝั่งเดียวกัน **ใช้ของชุดเดียวกัน** — ติดตั้งครั้งเดียวได้ทั้งคู่

## สิ่งที่ต้องมี

| | ทำไม | เช็ก |
|---|---|---|
| Claude Code **2.1.287+** | ตัวกันชั้น mod ต้องใช้รุ่นนี้ | `claude --version` |
| **node 22.18+** | ตัวกันหลัก (PreToolUse hook) รันด้วย node — **ไม่มี → Claude รันคำสั่ง shell ไม่ได้เลย** (ตั้งใจ ดู [ความปลอดภัย](../README.md#ความปลอดภัย)) | `node --version` |
| Windows: **Git for Windows** | ให้ hook รันด้วย Git Bash — ไม่มี ตัวกันจะไม่ทำงานใน auto mode | `git --version` |
| สิทธิ์อ่าน repo `GotPatipan39/gppi` | repo เป็น private — ขอให้เจ้าของเพิ่มเป็น collaborator | เปิด https://github.com/GotPatipan39/gppi ได้ |

---

## Windows

### 1. ติดตั้ง node และ Git (ถ้ายังไม่มี)
```powershell
winget install OpenJS.NodeJS.LTS
winget install Git.Git
```
ปิดแล้วเปิด PowerShell ใหม่ แล้วเช็ก `node --version` (ต้อง v22.18 ขึ้นไป) และ `git --version`

### 2. ติดตั้ง Claude Code (CLI)
VS Code extension มี Claude Code มาในตัวแล้ว แต่พิมพ์ `claude` ใน terminal ไม่ได้ — ติดตั้ง CLI ให้ใช้คำสั่งในคู่มือนี้ได้:
```powershell
irm https://claude.ai/install.ps1 | iex
```
ถ้าจบด้วยคำเตือน `...\.local\bin is not in your PATH` ให้เพิ่มเข้า PATH (เฉพาะบัญชีตัวเอง ไม่ต้องใช้ admin):
```powershell
$bin = "$env:USERPROFILE\.local\bin"; $p = [Environment]::GetEnvironmentVariable("Path", "User"); if (($p -split ';') -notcontains $bin) { [Environment]::SetEnvironmentVariable("Path", "$p;$bin", "User"); "added" } else { "already in PATH" }
```
> [!WARNING]
> terminal ใน VS Code รับ PATH ตอน VS Code เปิด — **ต้องปิด VS Code ทุกหน้าต่างแล้วเปิดใหม่** ปิดแค่ terminal ไม่พอ

เช็ก: `claude --version` → ต้องได้ 2.1.287 ขึ้นไป

### 3. Login และ trust โฟลเดอร์
```powershell
cd D:\ws\<โปรเจกต์ของคุณ>
claude
```
- ครั้งแรกจะเปิด browser ให้ login — ใช้บัญชีเดียวกับใน VS Code
- จะถาม **"Is this a project you created or one you trust?"** — ตอบ Yes **เฉพาะเมื่อเปิดในโฟลเดอร์โปรเจกต์** อย่า trust โฟลเดอร์แม่อย่าง `D:\ws` (เท่ากับ trust ทุก repo ข้างใน รวมที่ clone มาจากที่อื่น)
- เสร็จแล้วพิมพ์ `/exit`

### 4. ให้ git เข้า repo private ได้
Claude Code ดึง plugin ด้วย git แบบไม่ถามรหัส — ต้องตั้งไว้ก่อน เลือกอย่างใดอย่างหนึ่ง:
- **มี SSH key กับ GitHub แล้ว** (`git clone git@github.com:...` ได้) — ไม่ต้องทำอะไร
- **ใช้ HTTPS**: ติดตั้ง GitHub CLI แล้ว login
  ```powershell
  winget install GitHub.cli
  gh auth login
  gh auth setup-git
  ```
  และตั้งให้ Claude Code ใช้ HTTPS (ตั้งถาวรใน User environment แล้วเปิด terminal ใหม่):
  ```powershell
  [Environment]::SetEnvironmentVariable("CLAUDE_CODE_PLUGIN_PREFER_HTTPS", "1", "User")
  ```

### 5. เอา mskills ออก (เฉพาะเครื่องที่เคยใช้)
```powershell
claude plugin list
```
ถ้าเห็น `mskills@mskills`:
```powershell
claude plugin uninstall mskills@mskills
claude plugin marketplace remove mskills
```
เปิดทั้งสองตัวพร้อมกัน กฎจะซ้ำ 2 ชุด ตัวกันทำงานซ้ำ และ skill มีสองชุด

### 6. ติดตั้ง gppi
```powershell
claude plugin marketplace add GotPatipan39/gppi
claude plugin install gppi@gppi
claude plugin list
```
ต้องเห็น:
```
❯ gppi@gppi
  Version: 0.1.0      ← หรือใหม่กว่า
  Scope: user
  Status: ✔ enabled
```

### 7. เปิด auto-update
**ปิดอยู่เป็นค่าเริ่มต้น** สำหรับ marketplace ที่ไม่ใช่ของ Anthropic — ไม่เปิดจะไม่ได้รุ่นใหม่เลย
```powershell
claude
```
พิมพ์ `/plugin` → แท็บ **Marketplaces** → `gppi` → **Enable auto-update**
ทำถูกจะเห็น `1 mod active · gppi` และบรรทัด `Auto-update enabled.` (ใน VS Code ทำผ่านเมนู **Manage plugins** ได้เหมือนกัน)

### 8. ตรวจว่าทำงาน
**เปิดแชทใหม่** (CLI: `/exit` แล้ว `claude`; VS Code: ปุ่ม `+`) — กฎและ hook โหลดตอนเริ่ม session เท่านั้น `/reload-plugins` ไม่พอ

1. ถาม `ตอนนี้มีกฎอะไรบ้าง และมาจากไหน` → ต้องตอบว่ามาจาก plugin **gppi**
2. สั่ง `รัน ros2 topic pub /test std_msgs/msg/String "{}"` → ต้อง **ถามก่อนรัน** → กด **No**
   - CLI: เห็น `Hook PreToolUse:... requires confirmation ... gppi: คำสั่งนี้อาจทำให้เครื่องจักรขยับ...`
   - VS Code: ไม่แสดงข้อความ gppi แต่ prompt จะไม่มีปุ่ม "Yes, allow ... for this project"

> [!CAUTION]
> prompt ตั้งค่าเริ่มต้นไว้ที่ **"1. Yes"** — กด Enter ครั้งเดียวคือ **อนุญาต** อ่านคำสั่งก่อนกดทุกครั้ง

---

## WSL (Ubuntu 22.04)
> [!NOTE]
> ยังไม่ได้ทดสอบบนเครื่องจริง — ถ้าคำสั่งไหนไม่ผ่าน แจ้งเจ้าของ repo

### 1. node 22.18+ จาก NodeSource
apt ของ Ubuntu 22.04 ให้ node 12 ซึ่งเก่าเกิน — ใช้ NodeSource (ติดตั้งที่ `/usr/bin/node` ซึ่ง hook มองเห็นทุก shell):
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version      # v22.18 ขึ้นไป
```
ถ้าใช้ `nvm` อยู่แล้ว ต้องให้ node อยู่ใน PATH ของ shell ที่ไม่ใช่ interactive ด้วย — nvm ตั้ง PATH ใน `.bashrc` ซึ่ง hook อาจมองไม่เห็น ทำให้คำสั่ง shell ถูกบล็อกทั้งหมด

### 2. Claude Code
```bash
curl -fsSL https://claude.ai/install.sh | bash
```
ปิด terminal แล้วเปิดใหม่ → `claude --version`

### 3. Login, git, ติดตั้ง gppi
เหมือนฝั่ง Windows ขั้น 3–8 โดย:
- โปรเจกต์บนไดรฟ์ D: อยู่ที่ `/mnt/d/...`
- git แบบ HTTPS: ใช้ `gh auth login` + `gh auth setup-git` (ติดตั้ง `gh` ตามคู่มือของ GitHub) หรือ fine-grained token แบบ read-only + `git config --global credential.helper store` แล้ว `git clone` repo ครั้งหนึ่งให้จำ token — แล้ว `export CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` ใน `~/.bashrc`

> [!WARNING]
> WSL มี ROS2 ตัวจริงได้ — ตอนทดสอบขั้น 8 กด **No** เท่านั้น และเช็กว่าไม่มี driver/node ของเครื่องจริงรันอยู่

---

## ปัญหาที่เจอบ่อย

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| `claude : The term 'claude' is not recognized` | ยังไม่ได้เพิ่ม PATH หรือยังไม่ได้ปิด-เปิด VS Code ใหม่ (Windows ขั้น 2) |
| Claude บอกว่า **"gppi: ตัวกันคำสั่ง ... รันไม่ได้ จึงบล็อกคำสั่ง shell ทุกตัว"** | hook หา node ไม่เจอหรือ node เก่ากว่า 22.18 — เช็ก `node --version` ใน shell เดียวกับที่ Claude ใช้ แล้วเปิด session ใหม่ |
| `marketplace add` ขึ้น error เรื่อง authentication / clone ไม่ได้ | git ยังเข้า repo private ไม่ได้ (ขั้น 4) หรือยังไม่ได้เป็น collaborator |
| สั่ง `ros2 topic pub` แล้ว **รันเลยไม่ถาม** | หยุดใช้กับเครื่องจริงก่อน — เช็กว่าเปิด **แชทใหม่** หลังติดตั้งแล้ว, `claude plugin list` เห็น gppi enabled, และ `node --version` ผ่าน; ถ้ายังไม่ถาม แจ้งเจ้าของ repo |
| มี skill ชื่อซ้ำกัน (`mskills:...` คู่กับ `gppi:...`) | ยังไม่ได้เอา mskills ออก (Windows ขั้น 5) |
| ไม่ได้รุ่นใหม่ทั้งที่เจ้าของออกเวอร์ชันแล้ว | ยังไม่ได้เปิด auto-update (ขั้น 7) — หรืออัปเดตเองด้วย `claude plugin marketplace update gppi` แล้ว `claude plugin update gppi@gppi` แล้วเปิดแชทใหม่ |

## ถอนการติดตั้ง
```bash
claude plugin uninstall gppi@gppi
claude plugin marketplace remove gppi
```
