#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════
#  apply-track.sh — دواك: تتبع الدليفري (المناديب + الخريطة اللحظية)
#  بيعمل نسخة احتياطية كاملة الأول، وبعدين يطبّق التعديلات، ويبني المشروع،
#  ولو البناء فشل بيرجّع كل حاجة لوحده. وفيه أمر تراجع بعد كده.
#
#  الاستخدام (من جوه فولدر المشروع):
#    bash apply-track.sh              تطبيق (نسخة احتياطية ← تعديل ← build)
#    bash apply-track.sh --dry-run    فحص بس: مفيش أي تغيير
#    bash apply-track.sh --rollback   رجوع المشروع لآخر نسخة احتياطية قبل التعديل
#    bash apply-track.sh --list       عرض النسخ الاحتياطية
#  خيارات: --no-build (من غير build) · --keep (ما ترجّعش لو الـ build فشل)
#          --force (طبّق حتى لو ملف اتعدّل عندك) · --dir المسار
# ══════════════════════════════════════════════════════════════════
set -euo pipefail

PATCH_ID="track-v1"
PAYLOAD_SHA256="184cbe0371bea143b72587b4440e213b4f2093be32483a39c50025d29186a0f1"
MODIFIED=(
  "README.md"
  "firestore.rules"
  "src/App.jsx"
  "src/firebase.js"
  "src/pages/AuthPage.jsx"
  "src/pages/PatientOrders.jsx"
  "src/pages/PatientRx.jsx"
  "src/pages/PharmacyDash.jsx"
  "src/pages/Search.jsx"
  "src/styles.css"
)
NEW=(
  "src/lib/map.js"
  "src/tilemap.jsx"
  "src/pages/Couriers.jsx"
  "src/pages/Courier.jsx"
  "src/pages/Track.jsx"
)
# ملف بيتنسخ بس لو مش موجود عندك
CREATE_ONLY=(  )
BASELINE='aa6eb5f9f1275d3c3eb79d1419443f280e2844bf7c6379d5ebb9de16b0c05a06 README.md
863cc863baa6e08fd3ad772c76fcd6d5ebed4b2874c7d28ad67a7fba5d4a090b firestore.rules
b9ad10806bd6d1fc0d7303fcafd01c8e4e6833611c4359ec855cdad8f17e57d3 src/App.jsx
1c41cd1d6484adc7ab482cfffae014a7cc838acfc4e220e09ffb9f0fd039e1b4 src/firebase.js
5e2ab563802ce646c2c9abf23a6e56c8304aac5c7cc7fbae840ab93e26c2c5fb src/pages/AuthPage.jsx
8d990049d29c3796514304e215d4ed6564f09c6ad0aa8736fab6eaab38ef4c90 src/pages/PatientOrders.jsx
feb4d5c5a2240c777e6ad0e2ca50c4715f3232ae8034b6eb4b4316c9403e1e06 src/pages/PatientRx.jsx
bab8486fd91301ad538fc776e2a6031c0dfce3b3137bfef75df7c98109aab406 src/pages/PharmacyDash.jsx
a4e81cea1ee4ae7b22dad0e5bcf2a889910a75508d092fd0340a53cd0ebf2ec7 src/pages/Search.jsx
ffb041121bf17980ae8d0a405cf4312744933cbf63df49f2d2b73499698724d0 src/styles.css'

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
BK="$P/backups"; TMP="$P/.track-tmp"; MARK="$P/.track-applied"
TS="$(date +%Y%m%d-%H%M%S)"
trap 'rm -rf "$TMP"' EXIT

sha() { sha256sum "$1" | cut -d' ' -f1; }
make_backup() {  # $1 = اسم الملف
  mkdir -p "$BK"
  tar -czf "$1" --exclude=./node_modules --exclude=./dist --exclude=./.git --exclude=./backups \
      --exclude=./.track-tmp --exclude=./.firebase --exclude=./.vercel --exclude='./.env' --exclude='./.env.*' -C "$P" .
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

latest_backup() { ls -1t "$BK"/pre-track-*.tar.gz 2>/dev/null | head -1 || true; }

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
for f in "${MODIFIED[@]}" "${NEW[@]}" ${CREATE_ONLY[@]+"${CREATE_ONLY[@]}"}; do [ -f "$TMP/new/$f" ] || die "الحزمة ناقصة: $f"; done
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
for f in ${CREATE_ONLY[@]+"${CREATE_ONLY[@]}"}; do [ -e "$f" ] || say "  + $f"; done
if [ "$MODE" = dry ]; then say "✓ فحص بس: مفيش أي تغيير اتعمل."; exit 0; fi

# 3) نسخة احتياطية كاملة قبل أي تغيير
say "▶ نسخة احتياطية…"
BKF="$BK/pre-track-$TS.tar.gz"
make_backup "$BKF"
: > "${BKF%.tar.gz}.added"
for f in "${NEW[@]}"; do [ -e "$f" ] || echo "$f" >> "${BKF%.tar.gz}.added"; done
for f in ${CREATE_ONLY[@]+"${CREATE_ONLY[@]}"}; do [ -e "$f" ] || echo "$f" >> "${BKF%.tar.gz}.added"; done
if [ -d .git ] && command -v git >/dev/null 2>&1; then
  git tag "backup/pre-track-$TS" HEAD 2>/dev/null && say "  ✓ علامة git: backup/pre-track-$TS" || warn "ما قدرتش أعمل علامة git (عادي لو مفيش commits)"
fi
say "  (الـ .env وملفات الأسرار مش داخلة في النسخة، ومش بتتلمس)"

# 4) تطبيق
say "▶ تطبيق التعديلات…"
for f in "${MODIFIED[@]}" "${NEW[@]}"; do mkdir -p "$(dirname "$f")"; cp "$TMP/new/$f" "$f"; done
for f in ${CREATE_ONLY[@]+"${CREATE_ONLY[@]}"}; do [ -e "$f" ] || cp "$TMP/new/$f" "$f"; done
grep -qx 'backups/' .gitignore || printf 'backups/\n.track-tmp/\n.track-applied\n' >> .gitignore
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
say "  2) انشر:            bash deploy.sh \"تتبع الدليفري\""
say "  3) من لوحة الصيدلية ← المناديب: ضيف مندوب، وجرّب طلب بخروج للتوصيل"
exit 0

__PAYLOAD_BELOW__
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
AA==
