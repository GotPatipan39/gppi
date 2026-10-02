#!/usr/bin/env bash
# copy skill จาก repo mskills (โฟลเดอร์ที่ไฟล์นี้อยู่) ไปให้ Claude Code ใน WSL / Linux ใช้
#
#   ./install-skills.sh                                   # skill ทั่วไป → ~/.claude/skills (ทุกโปรเจกต์)
#   ./install-skills.sh -p ~/fg-robot-pallet ros2-humble-cpp modbus industrial-ui   # เฉพาะโปรเจกต์
#
# skill ที่ต้องใช้คู่กัน (grill-me → grilling) จะถูก copy ให้อัตโนมัติ
# copy ทับของเดิม แต่ไม่ลบไฟล์ที่มีอยู่แล้วในปลายทาง
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GLOBAL_DEFAULT=(grilling grill-me domain-modeling grill-with-docs project-readme)

requires() {
  case "$1" in
    grill-me)        echo grilling ;;
    grill-with-docs) echo grilling domain-modeling ;;
  esac
}

project=""
if [[ "${1:-}" == "-p" ]]; then
  project="${2:?ต้องใส่ path โปรเจกต์หลัง -p}"; shift 2
  [[ -d "$project" ]] || { echo "ไม่พบโฟลเดอร์โปรเจกต์: $project" >&2; exit 1; }
  target="$project/.claude/skills"
else
  target="$HOME/.claude/skills"
fi

skills=("$@")
[[ ${#skills[@]} -eq 0 ]] && skills=("${GLOBAL_DEFAULT[@]}")

all=()
add() { local x; for x in "${all[@]:-}"; do [[ "$x" == "$1" ]] && return; done; all+=("$1"); }
for s in "${skills[@]}"; do
  for d in $(requires "$s"); do add "$d"; done
  add "$s"
done

missing=()
for s in "${all[@]}"; do [[ -f "$SRC/$s/SKILL.md" ]] || missing+=("$s"); done
if [[ ${#missing[@]} -gt 0 ]]; then
  echo "ไม่พบ skill: ${missing[*]}" >&2
  echo "ที่มีอยู่: $(cd "$SRC" && for d in */; do [[ -f "$d/SKILL.md" ]] && printf '%s ' "${d%/}"; done)" >&2
  exit 1
fi

echo "ปลายทาง: $target"
mkdir -p "$target"
for s in "${all[@]}"; do
  mkdir -p "$target/$s"
  cp -r "$SRC/$s/." "$target/$s/"
  ver="$(grep -oP 'เวอร์ชัน\s+\K[0-9.]+' "$SRC/$s/SKILL.md" | head -1 || true)"
  echo "  ✓ $s${ver:+ ($ver)}"
done
# CLAUDE.md ระดับเครื่อง (เฉพาะการติดตั้งแบบทุกโปรเจกต์) — ใส่ไว้ระหว่าง marker, เนื้อหาอื่นไม่ถูกแตะ
if [[ -z "$project" && -f "$SRC/global-CLAUDE.md" ]]; then
  python3 - "$SRC/global-CLAUDE.md" "$HOME/.claude/CLAUDE.md" "$SRC" <<'PY'
import sys, os
src, dst, skills_dir = sys.argv[1], sys.argv[2], sys.argv[3]
begin = "<!-- BEGIN claude-skills (จัดการโดย install-skills — อย่าแก้ในบล็อกนี้) -->"
end = "<!-- END claude-skills -->"
block = begin + "\n" + open(src, encoding="utf-8-sig").read().replace("{{SKILLS_DIR}}", skills_dir).rstrip() + "\n" + end
old = open(dst, encoding="utf-8").read() if os.path.exists(dst) else ""
bi, ei = old.find("<!-- BEGIN claude-skills"), old.find(end)
if bi >= 0 and ei > bi:
    new, how = old[:bi] + block + old[ei + len(end):], "อัปเดตบล็อกเดิม"
elif old.strip():
    new, how = old.rstrip() + "\n\n" + block + "\n", "เพิ่มต่อท้าย (เนื้อหาเดิมยังอยู่)"
else:
    new, how = block + "\n", "สร้างใหม่"
os.makedirs(os.path.dirname(dst), exist_ok=True)
open(dst, "w", encoding="utf-8").write(new)
print(f"  ✓ CLAUDE.md ({how}) — {dst}")
PY
fi

echo
echo "เสร็จแล้ว — reload VS Code แล้วพิมพ์ / เพื่อดูรายการ skill"
