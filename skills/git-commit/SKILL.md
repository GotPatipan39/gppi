---
name: git-commit
description: ใช้เมื่อจะ commit หรือออก release — เขียน commit message แบบ Conventional Commits ที่ body อธิบายเหตุผล, ตรวจไฟล์ที่ไม่ควร commit (.env, build output, ค่า config เครื่องจริงที่แก้ชั่วคราว), แยก diff ที่ปนกันหลายเรื่อง, ออกเวอร์ชัน vX.Y.Z พร้อม CHANGELOG.md และ git tag — ใช้ทุกครั้งที่ผู้ใช้สั่ง commit, release, ออกเวอร์ชัน, tag หรือเมื่อ Claude กำลังจะ commit เอง
---

# Git commit และ release

> เวอร์ชัน 1.0.0 — ดู [CHANGELOG.md](CHANGELOG.md)

ถ้า `CLAUDE.md` ของโปรเจกต์กำหนดรูปแบบ commit ไว้ต่างจากนี้ ให้ยึดของโปรเจกต์

## commit ทั่วไป

### 1. ดูก่อนว่าจะ commit อะไร
```bash
git status --porcelain
git diff --staged        # ถ้ามีของ stage อยู่แล้ว
git diff                 # ถ้ายังไม่ได้ stage
git log --oneline -15    # ดูรูปแบบและภาษาที่ repo นี้ใช้อยู่
```
stage ทีละไฟล์ด้วย `git add <path>` — ไม่ใช้ `git add -p` / `-i` (interactive ใช้ใน Claude Code ไม่ได้) และระวัง `git add -A` / `git add .` ที่จะเก็บไฟล์ที่ไม่ตั้งใจไปด้วย

### 2. ตรวจของที่ห้าม commit — เจอแล้วหยุดถามผู้ใช้ ไม่ commit ต่อเอง
| เจอ | ตัวอย่าง | ทำไม |
|---|---|---|
| ไฟล์ลับ | `.env`, `*.pem`, `id_rsa`, password/token ใน code หรือ config | push ขึ้น GitLab แล้วลบออกจาก history ยาก |
| ไฟล์ที่ build ได้ใหม่ | `build/`, `install/`, `log/` (colcon), `node_modules/`, `__pycache__/`, `dist/` | ใหญ่ เปลี่ยนทุก build ทำให้ diff อ่านไม่ออก — ถ้าโดน stage แปลว่า `.gitignore` ขาด ให้เสนอเพิ่ม |
| ค่าเครื่องจริงที่แก้ชั่วคราว | IP, port, slave ID, speed, limit, timeout ใน `.env`, `*.yaml`, `*.json`, launch, params ที่เปลี่ยนในงานที่ไม่ได้ตั้งใจแก้ค่านั้น | ลองบนโต๊ะแล้วลืมคืน → เครื่องหน้างานได้ค่าทดสอบไป |

- ค่าเครื่องจริงที่เปลี่ยน: ถามว่า "ตั้งใจเปลี่ยน หรือแก้ชั่วคราวตอนทดสอบ" ก่อนทุกครั้ง แม้จะดูตั้งใจ
- ถ้า diff **ลด**เกณฑ์ความปลอดภัย (timeout, limit, watchdog, interlock) ต้องให้ผู้ใช้ยืนยัน และเขียนเหตุผลใน body

### 3. diff ปนกันหลายเรื่อง → เสนอการแยก ให้ผู้ใช้ยืนยันก่อน
หนึ่ง commit = หนึ่งเรื่อง เพื่อให้ revert ทีละเรื่องได้ เช่น แก้ bug Modbus + เปลี่ยนสีปุ่ม = 2 commit
เสนอเป็นรายการ: commit ไหน มีไฟล์อะไร message อะไร แล้วรอยืนยัน — ไฟล์เดียวที่มีหลายเรื่องในไฟล์เดียวกัน แยกด้วย `-p` ไม่ได้ ให้บอกผู้ใช้แทนการเดา

### 4. เขียน message
```
<type>[(scope)]: <สรุปสิ่งที่เปลี่ยน — imperative, ไม่เกิน 72 ตัวอักษร>

<body>

Co-Authored-By: ...   ← คงบรรทัดที่ Claude Code ใส่ให้ ไม่ลบ
```
| type | ใช้เมื่อ |
|---|---|
| `feat` | ความสามารถใหม่ หรือพฤติกรรมที่ผู้ใช้เห็นเปลี่ยน |
| `fix` | แก้ bug |
| `tune` | ปรับค่า parameter / timing / threshold ไม่เปลี่ยน logic (เช่น `tune: raise D100 re-arm delay from 1s to 10s`) — body บอกค่าเดิม → ค่าใหม่ และวัด/สังเกตอะไรมา |
| `refactor` | จัดโค้ดใหม่ พฤติกรรมเหมือนเดิม |
| `docs` | เอกสารอย่างเดียว |
| `style` | หน้าตา/format ไม่เปลี่ยน logic |
| `test` | เพิ่ม/แก้ test |
| `build` / `ci` | build system, dependency, pipeline |
| `chore` | งานดูแลอื่นๆ (script, ลบของเก่า) |
| `perf` | เร็วขึ้น พฤติกรรมเหมือนเดิม |

**บรรทัดแรก** บอกผลที่เกิด ไม่ใช่สิ่งที่ทำกับโค้ด: `fix: stop PLC link recovery from wiping pallet box counts` ดีกว่า `fix: update plcStatusWatcher.js`

**body — หัวใจของ commit** เขียนให้คนที่มาแก้ทีหลังไม่ย้อนทำ bug เดิม:
- **ทำไม** ต้องเปลี่ยน — อาการที่เห็น และสาเหตุจริง (กลไก ไม่ใช่แค่ "แก้ให้ถูก")
- **ตัวเลขที่วัดได้** ถ้ามี และวัดอย่างไร ("wrong in 309 of 999 sampled positions", "measured across all 108 stored models")
- **สิ่งที่ตั้งใจไม่ทำ** และผลถ้าทำ ("A zero tolerance would make 41 production models uneditable")
- **ความเสียหายที่ป้องกันได้** เมื่อเป็นการปฏิเสธ/หยุด แทนการเดา
- ห้ามเดาเหตุผลหรือตัวเลข — ไม่รู้ให้ถาม หรือเขียนแค่สิ่งที่รู้จริง
- ความยาวตามขนาดเรื่อง: `style:` ปรับความสูงช่อง → ไม่ต้องมี body; bug ที่หาสาเหตุนาน → หลายย่อหน้าได้

**ภาษา**: ตาม `git log` ของ repo นั้น; repo ใหม่ใช้อังกฤษ

### 5. commit
```bash
git commit -F - <<'EOF'
fix: ...

...
EOF
```
- hook fail → แก้สาเหตุ แล้วสร้าง commit ใหม่ (ไม่ `--amend`, ไม่ `--no-verify`)
- ไม่แก้ `git config`, ไม่ push ถ้าผู้ใช้ไม่ได้สั่ง

## release — ทำเฉพาะเมื่อผู้ใช้สั่ง ("release", "ออกเวอร์ชัน", "tag")

**ใช้เลขเวอร์ชันเดียวทั้งโปรเจกต์** แม้มีหลายส่วน (api, ui, scanner, ROS2 package) — เครื่องหน้างานติดตั้งทั้งชุด

### เลือกเลข — นับตามผลต่อหน้างาน แล้วเสนอให้ผู้ใช้ยืนยัน
| ขึ้น | เมื่อ |
|---|---|
| **major** `1.3.0 → 2.0.0` | ต้องทำอะไรกับเครื่องตอนติดตั้ง: address map / PLC program / การต่อสาย / config ที่ต้องตั้งใหม่ / ข้อมูลเก่าใช้ไม่ได้ |
| **minor** `1.3.0 → 1.4.0` | feature ใหม่ หรือพฤติกรรมที่ operator สังเกตเห็นเปลี่ยน |
| **patch** `1.3.0 → 1.3.1` | แก้ bug, operator ใช้งานเหมือนเดิม |

บอกเหตุผลที่เลือก เช่น "minor — มี feat 2 ตัว ไม่มีอะไรต้องตั้งที่เครื่อง" — ถ้ามี commit ที่แตะ address/register/PLC/wiring ให้ถามว่าต้องเป็น major ไหม

**หาเวอร์ชันล่าสุด** — repo เก่าอาจเคยออกเวอร์ชันด้วย commit message อย่างเดียว ไม่มี tag:
```bash
git describe --tags --abbrev=0 --match 'v*'                                   # tag ล่าสุด
git log --format='%h %ad %s' --date=short -E --grep='^v[0-9]+\.[0-9]+\.[0-9]+' # commit แบบ vX.Y.Z
```
- ใช้ตัวที่ใหม่กว่าระหว่าง tag กับ commit `vX.Y.Z` เป็นจุดเริ่มนับ
- เลขไม่เรียงกัน (เช่น `v2.0.2` อยู่ระหว่าง `v1.0.3` กับ `v1.0.4`) หรือ commit `vX.Y.Z` ไม่มี tag → บอกผู้ใช้ ให้เลือกว่าเลขไหนคือปัจจุบัน และเสนอใส่ tag ย้อนหลังให้ commit เก่า (`git tag -a v1.0.8 <hash> -m v1.0.8`) — ทำเมื่อผู้ใช้ตกลงเท่านั้น

**release ครั้งแรก** (ไม่มีทั้ง tag และ commit `vX.Y.Z`): ถามผู้ใช้ว่าเริ่มที่ `v1.0.0` (ใช้งานหน้างานแล้ว) หรือ `v0.1.0` (ยังพัฒนาอยู่) — ห้ามเลือกเอง

### ขั้นตอน
1. working tree ต้องสะอาด — มีของค้างให้ commit ตามขั้นตอนข้างบนก่อน
2. รวบรวมสิ่งที่เปลี่ยน: `git log --oneline <release ล่าสุด>..HEAD` — commit ที่ message ไม่บอกอะไร (`edit save`, `u`) ให้ดูจาก diff ของมันแทนการเดาจากชื่อ
   (release แรก: ไม่ต้องไล่ทุก commit สรุปเป็นกลุ่มความสามารถหลักแทน)
3. **ถามระดับการทดสอบ** — ห้ามเดา: build / unit test / simulator / hardware ไม่มีโหลด / ใช้งานจริง (+ อุปกรณ์ที่ใช้, วันที่) ถ้ายังไม่ได้ทดสอบกับเครื่อง ให้เขียนตามจริง
4. แก้ `CHANGELOG.md` ที่ root (ไม่มี → สร้าง) — เวอร์ชันใหม่อยู่บนสุด เขียนให้**คนที่จะอัปเดตเครื่อง**อ่าน ไม่ใช่ copy commit message:
   ```markdown
   ## v1.4.0 — 2026-10-02
   Tested: hardware ไม่มีโหลด (FX5 + robot)
   - เพิ่ม: หมุน layer 180° และจัดกลาง pallet
   - แก้: retry เมื่อ Modbus ล้มเหลวชั่วคราว แทนการทิ้งคำสั่ง
   ⚠ ติดตั้ง: <เฉพาะ major — สิ่งที่ต้องทำกับเครื่องก่อน/หลังอัปเดต ทีละขั้น>
   ```
   ภาษาตามเอกสารเดิมของ repo (README); บรรทัด "⚠ ติดตั้ง" บังคับสำหรับ major
5. แก้เลขเวอร์ชันในทุกไฟล์ให้ตรงกัน — หาด้วย `git grep -nE '"version"|<version>|VERSION'` เช่น `package.json` (`"version"`), `package.xml` (`<version>`), `pyproject.toml`, `setup.py`, `CMakeLists.txt` (`project(... VERSION ...)`); ไฟล์ lock (`package-lock.json`) แก้ด้วย `npm version <x.y.z> --no-git-tag-version` ในโฟลเดอร์นั้น ไม่แก้มือ
6. commit:
   ```
   v1.4.0: <สรุปทั้งเวอร์ชันสั้นๆ>

   - feat: ...
   - fix: ...

   Tested: <ระดับ> (<อุปกรณ์>, <วันที่>)
   ```
7. `git tag -a v1.4.0 -m "v1.4.0"`
8. ถามว่าจะ push ไหม — ถ้าใช่: `git push origin <branch>` และ `git push origin v1.4.0` (ไม่ push tag = tag อยู่แค่เครื่องนี้)

## ข้อยกเว้น: repo mskills
skill แต่ละตัวมีเวอร์ชันของตัวเอง — **release ราย skill, ไม่มี git tag**
- แก้บรรทัด `> เวอร์ชัน X.Y.Z` ใน `SKILL.md`, เพิ่มหัวข้อใน `CHANGELOG.md` ของ skill นั้น และแก้เลขในตาราง skill ของ `README.md`
- commit: `<skill> vX.Y.Z: <สรุป>` เช่น `modbus v1.1.0: add ME231 energy registers`
- commit อื่นใน mskills ใช้รูปแบบ commit ทั่วไปข้างบน
- เสร็จแล้วรันติดตั้งใหม่ (`scripts/install-skills.ps1 -All`) ให้ `~/.claude/skills` ตรงกับ repo

## สรุปให้ผู้ใช้หลัง commit/release
- commit hash + บรรทัดแรก (หลาย commit → เป็นรายการ)
- สิ่งที่หยุดถาม/ข้ามไป และไฟล์ที่ยังไม่ได้ commit
- release: เลขเวอร์ชัน, tag, push แล้วหรือยัง
