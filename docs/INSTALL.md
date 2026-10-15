# ติดตั้ง gppi ทีละขั้น

คู่มือนี้พาจากเครื่องเปล่าจนตัวกันคำสั่งทำงาน — ทำตามลำดับ ไม่ต้องข้ามไปอ่านที่อื่น
ทดสอบแล้วบนเครื่องจริงทั้ง Windows และ WSL (2026-10-14) — ถ้าติดตรงไหนแจ้งเจ้าของ repo

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

### 5. ติดตั้ง gppi
```powershell
claude plugin marketplace add GotPatipan39/gppi
claude plugin install gppi@gppi
claude plugin list
```
ต้องเห็น:
```
❯ gppi@gppi
  Version: 0.1.1      ← หรือใหม่กว่า
  Scope: user
  Status: ✔ enabled
```

### 6. เปิด auto-update
**ปิดอยู่เป็นค่าเริ่มต้น** สำหรับ marketplace ที่ไม่ใช่ของ Anthropic — ไม่เปิดจะไม่ได้รุ่นใหม่เลย
```powershell
claude
```
พิมพ์ `/plugin` → แท็บ **Marketplaces** → `gppi` → **Enable auto-update**
ทำถูกจะเห็น `1 mod active · gppi` และบรรทัด `Auto-update enabled.` (ใน VS Code ทำผ่านเมนู **Manage plugins** ได้เหมือนกัน)

### 7. ตรวจว่าทำงาน
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
> ทดสอบแล้ว 2026-10-14 บน WSL Ubuntu 22.04 (Claude Code 2.1.299, node 22.23.3, git ผ่าน HTTPS ด้วย GitHub CLI = ขั้น 3 ทาง B) — ทาง A (SSH key) ยังไม่ได้ลองใน WSL

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
grep -q '.local/bin' ~/.bashrc || echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
claude --version
```
บรรทัดที่ 2 จำเป็น — installer วางโปรแกรมไว้ที่ `~/.local/bin` ซึ่ง Ubuntu เพิ่มเข้า PATH ผ่าน `~/.profile` เท่านั้น แต่ terminal ของ WSL (โดยเฉพาะใน VS Code) มักเป็น shell แบบ non-login ที่อ่านแค่ `~/.bashrc` → ได้ `claude: command not found` ใน terminal ใหม่ (`source ~/.profile` แก้ได้แค่ terminal ที่เปิดอยู่)

### 3. ให้ git ใน WSL เข้า GitHub ได้
WSL ใช้กุญแจ/สิทธิ์ **คนละชุดกับ Windows** — ถึงฝั่ง Windows ใช้ได้ WSL ก็ต้องตั้งใหม่ (และ `winget` ใช้ใน WSL ไม่ได้)
```bash
ssh -T git@github.com
```
- ได้ `Hi <username>! You've successfully authenticated` → ข้ามไปขั้น 4
- ได้ `Permission denied (publickey)` → เลือกทางใดทางหนึ่ง:

**ทาง A: SSH key (ขั้นตอนน้อยกว่า)**
```bash
ssh-keygen -t ed25519 -C "wsl-<ชื่อเครื่อง>"     # กด Enter 3 ครั้ง
cat ~/.ssh/id_ed25519.pub                        # copy ทั้งบรรทัด
```
เปิด https://github.com/settings/keys → **New SSH key** → วาง → **Add SSH key** แล้วเช็กด้วย `ssh -T git@github.com` อีกครั้ง
ส่งให้คนอื่นได้เฉพาะไฟล์ `.pub` — ไฟล์ `id_ed25519` (ไม่มี .pub) ห้ามส่งให้ใคร

**ทาง B: HTTPS ผ่าน GitHub CLI (ทดสอบแล้ว)**
```bash
sudo mkdir -p -m 755 /etc/apt/keyrings && wget -qO- https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null && sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null && sudo apt update && sudo apt install gh -y
gh auth login          # GitHub.com → HTTPS → Yes → Login with a web browser (ใส่รหัสที่ github.com/login/device)
gh auth setup-git
echo 'export CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1' >> ~/.bashrc && source ~/.bashrc
```

### 4. Login, ติดตั้ง gppi, ตรวจ
เหมือนฝั่ง Windows ขั้น 3, 5–7 — โปรเจกต์บนไดรฟ์ D: อยู่ที่ `/mnt/d/...`

> [!WARNING]
> WSL มี ROS2 ตัวจริงได้ — ตอนทดสอบ (Windows ขั้น 7) กด **No** เท่านั้น และเช็กว่าไม่มี driver/node ของเครื่องจริงรันอยู่

---

## เพิ่มเติม (ไม่บังคับ): Context7 — doc ของ library ล่าสุด
ให้ Claude ดู doc ของ library (rclcpp, OpenCV, pymodbus, Node-RED ...) แทนการจำ — อ่านอย่างเดียว ไม่แตะเครื่องจักร จึงเพิ่มระดับผู้ใช้ครั้งเดียว ใช้ได้ทุกโปรเจกต์ (ทำทั้งใน Windows และ WSL ถ้าใช้ทั้งคู่):
```bash
claude mcp add --scope user --transport http context7 https://mcp.context7.com/mcp
claude mcp list        # ต้องเห็น context7 ... ✔ Connected
```
- คำถามที่ Claude ส่งไปจะไปที่ server ของ Upstash — rules.md กำหนดให้ใส่แค่ชื่อ library + เวอร์ชัน + หัวข้อ ไม่ใส่โค้ดหรือข้อมูลโปรเจกต์
- doc ส่วนใหญ่เป็นรุ่นล่าสุด (ไม่มี rclcpp Humble) — Claude ยังต้องเทียบกับ header/`--help` ในเครื่อง; ไม่ได้ติดตั้งก็ใช้งานได้ตามปกติ
- เอาออก: `claude mcp remove context7 -s user`

## ปัญหาที่เจอบ่อย

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| `claude : The term 'claude' is not recognized` | ยังไม่ได้เพิ่ม PATH หรือยังไม่ได้ปิด-เปิด VS Code ใหม่ (Windows ขั้น 2) |
| WSL: `claude: command not found` หลังติดตั้ง หรือใน terminal ใหม่ | เพิ่ม `~/.local/bin` ลง `~/.bashrc` (WSL ขั้น 2 บรรทัดที่ 2) แล้ว `source ~/.bashrc` |
| Claude บอกว่า **"gppi: ตัวกันคำสั่ง ... รันไม่ได้ จึงบล็อกคำสั่ง shell ทุกตัว"** | hook หา node ไม่เจอหรือ node เก่ากว่า 22.18 — เช็ก `node --version` ใน shell เดียวกับที่ Claude ใช้ แล้วเปิด session ใหม่ |
| `marketplace add` ขึ้น error เรื่อง authentication / clone ไม่ได้ | git ยังเข้า repo private ไม่ได้ (Windows ขั้น 4 / WSL ขั้น 3) หรือยังไม่ได้เป็น collaborator |
| สั่ง `ros2 topic pub` แล้ว **รันเลยไม่ถาม** | หยุดใช้กับเครื่องจริงก่อน — เช็กว่าเปิด **แชทใหม่** หลังติดตั้งแล้ว, `claude plugin list` เห็น gppi enabled, และ `node --version` ผ่าน; ถ้ายังไม่ถาม แจ้งเจ้าของ repo |
| skill ทำงานไม่ตรงกับเนื้อหาใน repo gppi / เห็น skill ชื่อสั้น (`modbus`) ซ้ำกับ `gppi:modbus` | มี skill ชื่อเดียวกันวางไว้เองใน `~/.claude/skills/` ซึ่ง **บังตัวใน plugin โดยไม่มีคำเตือน** — ย้ายออก (อย่าแตะ `~/.claude/skills/synced/`) แล้วเปิดแชทใหม่ |
| โปรเจกต์มี `.mcp.json` แต่ Claude ไม่ใช้ / ไม่เคยถามอนุมัติ | พิมพ์ `/mcp` ดูสถานะ; เคยกดปฏิเสธ → `claude mcp reset-project-choices` แล้วเปิดใหม่; server failed → ตั้งตัวแปรในเครื่องยังไม่ครบ หรือไม่มี `uv` — ดู [templates/mcp/README.md](../mcp/README.md) |
| ไม่ได้รุ่นใหม่ทั้งที่เจ้าของออกเวอร์ชันแล้ว | ยังไม่ได้เปิด auto-update (Windows ขั้น 6) — หรืออัปเดตเองด้วย `claude plugin marketplace update gppi` แล้ว `claude plugin update gppi@gppi` แล้วเปิดแชทใหม่ |

## ถอนการติดตั้ง
```bash
claude plugin uninstall gppi@gppi
claude plugin marketplace remove gppi
```
