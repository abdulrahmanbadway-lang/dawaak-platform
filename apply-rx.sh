#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════
#  apply-rx.sh — دواك: الروشتات + رد الصيدلي
#  بيعمل نسخة احتياطية كاملة الأول، وبعدين يطبّق التعديلات، ويبني المشروع،
#  ولو البناء فشل بيرجّع كل حاجة لوحده. وفيه أمر تراجع بعد كده.
#
#  الاستخدام (من جوه فولدر المشروع):
#    bash apply-rx.sh              تطبيق (نسخة احتياطية ← تعديل ← build)
#    bash apply-rx.sh --dry-run    فحص بس: مفيش أي تغيير
#    bash apply-rx.sh --rollback   رجوع المشروع لآخر نسخة احتياطية قبل التعديل
#    bash apply-rx.sh --list       عرض النسخ الاحتياطية
#  خيارات: --no-build (من غير build) · --keep (ما ترجّعش لو الـ build فشل)
#          --force (طبّق حتى لو ملف اتعدّل عندك) · --dir المسار
# ══════════════════════════════════════════════════════════════════
set -euo pipefail

PATCH_ID="rx-v1"
PAYLOAD_SHA256="530ae38f52cf36f32c7774c818930e81be19e470654aa18b422644ac3777ac2f"
MODIFIED=(
  ".gitignore"
  "README.md"
  "firestore.rules"
  "src/App.jsx"
  "src/lib/img.js"
  "src/lib/status.js"
  "src/pages/PatientOrders.jsx"
  "src/pages/PharmacyDash.jsx"
  "src/pages/Search.jsx"
  "src/styles.css"
)
NEW=(
  "src/lib/rx.js"
  "src/pages/PatientRx.jsx"
  "src/pages/PharmacyRx.jsx"
  "src/rxparts.jsx"
)
# ملف بيتنسخ بس لو مش موجود عندك
CREATE_ONLY=".env.example"
BASELINE='15bbd0ad7846da31985009735a416e8da9bd966432df1953bceea292745477da .gitignore
917287597bdc6751de1122ba7b0fd0f4cef98943e686733db90a963024046748 README.md
1d676a5806cbcf9263e30c1ffde6209f7908aedc3d06ef8738dd94f3769a17ed firestore.rules
29e32d472752e88215455b29e956754f202501edad406106bc22058baee5cf0f src/App.jsx
5181e1ac4f2ecb43a67daededbd741bf144271a5bd20d0b692650c53d7069762 src/lib/img.js
9e998024bebf0abed4ba548691d40575a212e25f610236261c0675e3f5eae9b5 src/lib/status.js
a0002aba20fc30fd64751d52905adbf10f2441169e1c1a4c93d31165d3f00a26 src/pages/PatientOrders.jsx
bcfad9802afa1223a152d09a648b5afc4151d83738bd15bc269af053d4089731 src/pages/PharmacyDash.jsx
e41c33f6e0e080d3d4cb3b656d3acd360136d26d73c203a6819b8de45f4e0416 src/pages/Search.jsx
31e0d7e4bafca9a24cf4a80e291643a140e55d645ae5f4b28027dc05e8749100 src/styles.css'

MODE=apply; FORCE=0; NOBUILD=0; KEEP=0; DIR=""; RB_FILE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) MODE=dry ;;
    --rollback) MODE=rollback; if [ $# -gt 1 ] && [ "${2#--}" = "$2" ]; then RB_FILE="$2"; shift; fi ;;
    --list) MODE=list ;;
    --force) FORCE=1 ;;
    --no-build) NOBUILD=1 ;;
    --keep) KEEP=1 ;;
    --dir) DIR="${2:-}"; shift ;;
    -h|--help) sed -n '2,17p' "$0"; exit 0 ;;
    *) echo "خيار غير معروف: $1"; exit 2 ;;
  esac
  shift
done

say()  { printf '%s\n' "$*"; }
warn() { printf '⚠ %s\n' "$*" >&2; }
die()  { printf '✗ %s\n' "$*" >&2; exit 1; }

# ── تحديد فولدر المشروع (مش لازم تكون واقف جواه: بنجرّب المكان الحالي ومكان السكربت)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
is_proj() { [ -f "$1/package.json" ] && grep -q '"name": *"dawaak-platform"' "$1/package.json"; }
if [ -n "$DIR" ]; then P="$DIR"
elif is_proj "$PWD"; then P="$PWD"
elif is_proj "$SCRIPT_DIR"; then P="$SCRIPT_DIR"
else die "مش لاقي مشروع dawaak-platform. ادخل فولدر المشروع الأول أو استخدم --dir المسار"; fi
is_proj "$P" || die "الفولدر ده مش مشروع dawaak-platform: $P"
cd "$P"; P="$PWD"
BK="$P/backups"; TMP="$P/.rx-tmp"; MARK="$P/.rx-applied"
TS="$(date +%Y%m%d-%H%M%S)"
trap 'rm -rf "$TMP"' EXIT

sha() { sha256sum "$1" | cut -d' ' -f1; }
make_backup() {  # $1 = اسم الملف
  mkdir -p "$BK"
  tar -czf "$1" --exclude=./node_modules --exclude=./dist --exclude=./.git --exclude=./backups \
      --exclude=./.rx-tmp --exclude=./.firebase --exclude=./.vercel --exclude='./.env' --exclude='./.env.*' -C "$P" .
  local n; n=$(tar -tzf "$1" | grep -vc '/$' || true)
  [ "$n" -gt 0 ] || die "النسخة الاحتياطية طلعت فاضية"
  tar -tzf "$1" >/dev/null || die "النسخة الاحتياطية تالفة"
  say "  ✓ نسخة احتياطية: ${1#$P/}  ($n ملف، $(du -h "$1" | cut -f1))"
}

do_rollback() {
  local f="$1"
  [ -f "$f" ] || die "مش لاقي النسخة: $f"
  say "▶ رجوع للنسخة: ${f#$P/}"
  mkdir -p "$BK"
  make_backup "$BK/pre-rollback-$TS.tar.gz"   # أمان: حالتك الحالية قبل الرجوع
  local added="${f%.tar.gz}.added"
  if [ -f "$added" ]; then
    while IFS= read -r a; do
      if [ -n "$a" ] && [ -f "$P/$a" ]; then rm -f "$P/$a"; say "  − اتشال: $a"; fi
    done < "$added"
  fi
  tar -xzf "$f" -C "$P"
  rm -f "$MARK"
  say "✓ المشروع رجع زي ما كان قبل التعديل."
  say "  لو كنت نشرت الـ Rules أو الموقع، انشر تاني: firebase deploy --only firestore:rules,hosting"
}

latest_backup() { ls -1t "$BK"/pre-rx-*.tar.gz 2>/dev/null | head -1 || true; }

case "$MODE" in
  list)
    ls -1t "$BK"/*.tar.gz 2>/dev/null | while read -r f; do say "$(du -h "$f" | cut -f1)  ${f#$P/}"; done
    [ -f "$MARK" ] && { say; say "التعديل مطبّق حالياً:"; cat "$MARK"; } || say "التعديل مش مطبّق."
    exit 0 ;;
  rollback)
    if [ -z "$RB_FILE" ]; then
      [ -f "$MARK" ] && RB_FILE="$(grep '^backup=' "$MARK" | cut -d= -f2-)"
      [ -n "$RB_FILE" ] || RB_FILE="$(latest_backup)"
    fi
    [ -n "$RB_FILE" ] || die "مفيش نسخة احتياطية في backups/"
    case "$RB_FILE" in /*) ;; *) RB_FILE="$P/$RB_FILE" ;; esac
    do_rollback "$RB_FILE"; exit 0 ;;
esac

# ───────────────────────── تطبيق ─────────────────────────
say "══ دواك · $PATCH_ID · المشروع: $P"
[ -f "$MARK" ] && die "التعديل ده متطبّق قبل كده. لو عايز ترجع: bash $(basename "$0") --rollback"

# 1) استخراج الحزمة والتأكد إنها سليمة
rm -rf "$TMP"; mkdir -p "$TMP/new"
awk '/^__PAYLOAD_BELOW__$/{f=1;next} f' "$0" | base64 -d > "$TMP/payload.tgz" 2>/dev/null || die "تعذر قراءة الحزمة. السكربت اتقطع أثناء النقل؟ نزّله تاني."
[ "$(sha "$TMP/payload.tgz")" = "$PAYLOAD_SHA256" ] || die "الحزمة تالفة (checksum مش مطابق). نزّل السكربت تاني."
tar -xzf "$TMP/payload.tgz" -C "$TMP/new"
for f in "${MODIFIED[@]}" "${NEW[@]}" "$CREATE_ONLY"; do [ -f "$TMP/new/$f" ] || die "الحزمة ناقصة: $f"; done
say "  ✓ الحزمة سليمة"

# 2) التأكد إن ملفاتك لسه زي ما كانت وقت تجهيز التعديل (عشان منمسحش شغلك)
bad=0
while read -r h f; do
  [ -n "$f" ] || continue
  if [ ! -f "$f" ]; then warn "ملف ناقص عندك: $f"; bad=1
  elif [ "$(sha "$f")" != "$h" ]; then warn "الملف ده اتعدّل عندك بعد النسخة اللي اشتغلت عليها: $f"; bad=1; fi
done <<< "$BASELINE"
if [ "$bad" = 1 ] && [ "$FORCE" = 0 ]; then
  die "وقفت من غير ما أغيّر حاجة. ابعتلي الملفات دي لو اتعدّلت، أو كمّل بـ --force (هيتاخد نسخة احتياطية الأول)."
fi
for f in "${NEW[@]}"; do [ -e "$f" ] && warn "ملف جديد موجود أصلاً وهيتستبدل: $f"; done

say "الملفات اللي هتتعدّل (${#MODIFIED[@]}):"; for f in "${MODIFIED[@]}"; do say "  ~ $f"; done
say "الملفات اللي هتتضاف (${#NEW[@]}):";    for f in "${NEW[@]}"; do say "  + $f"; done
[ -e "$CREATE_ONLY" ] || say "  + $CREATE_ONLY"
if [ "$MODE" = dry ]; then say "✓ فحص بس: مفيش أي تغيير اتعمل."; exit 0; fi

# 3) نسخة احتياطية كاملة قبل أي تغيير
say "▶ نسخة احتياطية…"
BKF="$BK/pre-rx-$TS.tar.gz"
make_backup "$BKF"
: > "${BKF%.tar.gz}.added"
for f in "${NEW[@]}"; do [ -e "$f" ] || echo "$f" >> "${BKF%.tar.gz}.added"; done
[ -e "$CREATE_ONLY" ] || echo "$CREATE_ONLY" >> "${BKF%.tar.gz}.added"
if [ -d .git ] && command -v git >/dev/null 2>&1; then
  git tag "backup/pre-rx-$TS" HEAD 2>/dev/null && say "  ✓ علامة git: backup/pre-rx-$TS" || warn "ما قدرتش أعمل علامة git (عادي لو مفيش commits)"
fi
say "  (الـ .env وملفات الأسرار مش داخلة في النسخة، ومش بتتلمس)"

# 4) تطبيق
say "▶ تطبيق التعديلات…"
for f in "${MODIFIED[@]}" "${NEW[@]}"; do mkdir -p "$(dirname "$f")"; cp "$TMP/new/$f" "$f"; done
[ -e "$CREATE_ONLY" ] || cp "$TMP/new/$CREATE_ONLY" "$CREATE_ONLY"
grep -qx 'backups/' .gitignore || printf 'backups/\n.rx-tmp/\n.rx-applied\n' >> .gitignore
printf 'patch=%s\ntime=%s\nbackup=%s\n' "$PATCH_ID" "$TS" "$BKF" > "$MARK"
say "  ✓ اتطبّقت"

# 5) البناء
if [ "$NOBUILD" = 1 ]; then
  warn "BUILD NOT VERIFIED — اتخطّى الـ build (--no-build). شغّل: npm run build"
else
  say "▶ npm run build…"
  if [ ! -d node_modules ]; then say "  (node_modules مش موجودة: npm install)"; npm install --no-audit --no-fund || true; fi
  if npm run build; then say "  ✓ البناء نجح"
  else
    echo
    if [ "$KEEP" = 1 ]; then warn "البناء فشل والتعديل لسه مطبّق (--keep). للتراجع: bash $(basename "$0") --rollback"; exit 1; fi
    warn "البناء فشل. برجّع المشروع لحالته الأولى…"
    do_rollback "$BKF"
    die "التعديل ما اتطبّقش لأن البناء فشل. ابعتلي رسالة الخطأ اللي فوق."
  fi
fi

say
say "══ تم ✓"
say "التراجع في أي وقت:  bash $(basename "$0") --rollback"
say "الخطوات اللي بعد كده (بالترتيب):"
say "  1) جرّب الـ Rules:  firebase emulators:start --only firestore"
say "  2) انشر:            bash deploy.sh \"الروشتات + رد الصيدلي\""
exit 0

__PAYLOAD_BELOW__
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
