#!/usr/bin/env bash
# copy skill จาก repo mskills ไปให้ Claude Code ใน WSL / Linux ใช้
#
#   scripts/install-skills.sh                                   # skill ทั่วไป → ~/.claude/skills (ทุกโปรเจกต์)
#   scripts/install-skills.sh --all                             # ทุก skill → ~/.claude/skills (เหมือน install-all-global.bat)
#   scripts/install-skills.sh -p ~/fg-robot-pallet ros2-humble-cpp modbus industrial-ui   # เฉพาะโปรเจกต์
#   scripts/install-skills.sh -p ~/fg-robot-pallet --all        # ทุก skill ลงโปรเจกต์
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
GLOBAL_DEFAULT=(grilling grill-me domain-modeling grill-with-docs project-readme git-commit tdd)

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
if [[ "${1:-}" == "--all" ]]; then
  [[ $# -eq 1 ]] || { echo "--all ใช้คู่กับชื่อ skill ไม่ได้" >&2; exit 1; }
  mapfile -t skills < <(printf '%s\n' "${!SKILL_DIR[@]}" | sort)
fi
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
# subagent (agents/*.md) → ~/.claude/agents (เฉพาะการติดตั้งแบบทุกโปรเจกต์)
if [[ -z "$project" && -d "$SRC/agents" ]]; then
  mkdir -p "$HOME/.claude/agents"
  for a in "$SRC"/agents/*.md; do
    [[ -f "$a" ]] || continue
    cp "$a" "$HOME/.claude/agents/"
    ver="$(grep -oP 'เวอร์ชัน\s+\K[0-9.]+' "$a" | head -1 || true)"
    echo "  ✓ agent $(basename "$a" .md)${ver:+ ($ver)}"
  done
fi
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
# permissions ระดับเครื่อง — เพิ่มกฎใน config/permissions.json ที่ settings.json ยังไม่มี, ไม่ลบ/แก้ค่าอื่น
if [[ -z "$project" && -f "$SRC/config/permissions.json" ]]; then
  python3 - "$SRC/config/permissions.json" "$HOME/.claude/settings.json" <<'PY'
import sys, os, json
src, dst = sys.argv[1], sys.argv[2]
want = json.load(open(src, encoding="utf-8-sig")).get("permissions", {})
cur = {}
if os.path.exists(dst):
    try:
        text = open(dst, encoding="utf-8-sig").read()
        cur = json.loads(text) if text.strip() else {}
    except ValueError:
        print(f"  ! settings.json อ่านไม่ได้ (JSON ไม่ถูกต้อง) — ข้าม ไม่แตะไฟล์: {dst}", file=sys.stderr)
        sys.exit(0)
perms = cur.setdefault("permissions", {})
added = 0
for kind in ("allow", "ask", "deny"):
    have = perms.get(kind, [])
    new = [r for r in want.get(kind, []) if r not in have]
    if new:
        perms[kind] = have + new
        added += len(new)
if added == 0:
    print("  ✓ settings.json (กฎครบแล้ว ไม่ได้แก้ไฟล์)")
else:
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    open(dst, "w", encoding="utf-8").write(json.dumps(cur, indent=2, ensure_ascii=False) + "\n")
    print(f"  ✓ settings.json (เพิ่มกฎ {added} ข้อ) — {dst}")
PY
fi

echo
echo "เสร็จแล้ว — reload VS Code แล้วพิมพ์ / เพื่อดูรายการ skill"
