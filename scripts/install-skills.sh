#!/usr/bin/env bash
# copy skill จาก repo mskills ไปให้ Claude Code ใน WSL / Linux ใช้
#
#   scripts/install-skills.sh                                   # skill ทั่วไป → ~/.claude/skills (ทุกโปรเจกต์)
#   scripts/install-skills.sh -p ~/fg-robot-pallet ros2-humble-cpp modbus industrial-ui   # เฉพาะโปรเจกต์
#
# หา skill จาก skills/<ชื่อ> (ของเราเอง) และ vendor/<ที่มา>/<ชื่อ> (จากภายนอก) — ปลายทางใช้แค่ <ชื่อ>
# skill จาก vendor จะได้ vendor/<ที่มา>/LICENSE copy ไปเป็น LICENSE ในโฟลเดอร์ skill ด้วย
# skill ที่ต้องใช้คู่กัน (grill-me → grilling) จะถูก copy ให้อัตโนมัติ
# copy ทับของเดิม แต่ไม่ลบไฟล์ที่มีอยู่แล้วในปลายทาง
set -euo pipefail

# root ของ repo (script อยู่ใน scripts/)
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ชื่อ skill → โฟลเดอร์ต้นทาง / LICENSE ของ vendor
declare -A SKILL_DIR=() SKILL_LIC=()
for f in "$SRC"/skills/*/SKILL.md "$SRC"/vendor/*/*/SKILL.md; do
  [[ -f "$f" ]] || continue
  d="$(dirname "$f")"; n="$(basename "$d")"
  [[ "$n" == _* ]] && continue
  if [[ -n "${SKILL_DIR[$n]:-}" ]]; then
    echo "skill ชื่อซ้ำ: $n" >&2; echo "  ${SKILL_DIR[$n]}" >&2; echo "  $d" >&2; exit 1
  fi
  SKILL_DIR[$n]="$d"
  lic="$(dirname "$d")/LICENSE"
  [[ "$d" == "$SRC"/vendor/* && -f "$lic" ]] && SKILL_LIC[$n]="$lic"
done
GLOBAL_DEFAULT=(grilling grill-me domain-modeling grill-with-docs project-readme git-commit)

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
for s in "${all[@]}"; do [[ -n "${SKILL_DIR[$s]:-}" ]] || missing+=("$s"); done
if [[ ${#missing[@]} -gt 0 ]]; then
  echo "ไม่พบ skill: ${missing[*]}" >&2
  echo "ที่มีอยู่: $(printf '%s\n' "${!SKILL_DIR[@]}" | sort | tr '\n' ' ')" >&2
  exit 1
fi

echo "ปลายทาง: $target"
mkdir -p "$target"
for s in "${all[@]}"; do
  src="${SKILL_DIR[$s]}"
  mkdir -p "$target/$s"
  cp -r "$src/." "$target/$s/"
  [[ -n "${SKILL_LIC[$s]:-}" ]] && cp "${SKILL_LIC[$s]}" "$target/$s/LICENSE"
  ver="$(grep -oP 'เวอร์ชัน\s+\K[0-9.]+' "$src/SKILL.md" | head -1 || true)"
  echo "  ✓ $s${ver:+ ($ver)}"
done
# CLAUDE.md ระดับเครื่อง (เฉพาะการติดตั้งแบบทุกโปรเจกต์) — ใส่ไว้ระหว่าง marker, เนื้อหาอื่นไม่ถูกแตะ
if [[ -z "$project" && -f "$SRC/config/global-CLAUDE.md" ]]; then
  python3 - "$SRC/config/global-CLAUDE.md" "$HOME/.claude/CLAUDE.md" "$SRC" <<'PY'
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
