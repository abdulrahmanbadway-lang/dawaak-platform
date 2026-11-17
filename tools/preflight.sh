#!/usr/bin/env bash
# فحص جاهزية قبل الإطلاق أو العرض. الاستخدام (من فولدر المشروع):  bash tools/preflight.sh [--no-build]
# بيفحص الإعدادات والقواعد والبناء، ومابيغيّرش أي حاجة. الفحوصات اليدوية في docs/MANUAL-TESTS.md
cd "$(dirname "$0")/.." || exit 1
bad=0; warn=0
ok()   { printf '✓ %s\n' "$*"; }
fail() { bad=1; printf '✗ %s\n' "$*"; }
note() { warn=1; printf '⚠ %s\n' "$*"; }

# 1) الأدوات والإعداد
command -v node >/dev/null && ok "node $(node -v)" || fail "node مش متثبّت"
[ -d node_modules ] && ok "الحزم متثبّتة" || note "node_modules مش موجود: شغّل npm install"
if [ -f .env.local ]; then
  for k in VITE_FIREBASE_API_KEY VITE_FIREBASE_AUTH_DOMAIN VITE_FIREBASE_PROJECT_ID VITE_FIREBASE_APP_ID; do
    grep -q "^$k=.\+" .env.local && ok "$k موجود" || fail "$k ناقص في .env.local"
  done
else note ".env.local مش موجود (لازم للتشغيل المحلي والبناء)"; fi
[ -f .firebaserc ] && ok "المشروع: $(grep -o '"default": *"[^"]*"' .firebaserc | cut -d'"' -f4)" || fail ".firebaserc ناقص"

# 2) قواعد الأمان: لازم الحمايات الأساسية تكون موجودة في الملف
R=firestore.rules
if [ -f "$R" ]; then
  for f in "function isAdmin" "function active" "function cartOk" "function shapeOk" "function valOk" "function courierOk" "function rxLinked"; do
    grep -q "$f" "$R" && ok "Rules: $f" || fail "Rules: ناقص $f (القواعد اتعدّلت أو قديمة؟)"
  done
  grep -q "allow read, write: if true" "$R" && fail "Rules فيها allow read, write: if true (مفتوحة للكل!)"
else fail "firestore.rules مش موجود"; fi
[ -f firebase.json ] && grep -q '"rules": *"firestore.rules"' firebase.json && ok "firebase.json بيشاور على firestore.rules" || fail "firebase.json مش بينشر firestore.rules"

# 3) الكتالوج: الصور البديلة لازم تكون هي المعتمدة لما مفيش صورة حقيقية
grep -q "categoryPlaceholder" src/lib/img.js && ok "صور بديلة للأقسام (categoryPlaceholder) موجودة" || fail "categoryPlaceholder ناقصة"
BAD=$(grep -rn "<img[^>]*src={[a-z]*\.imageUrl}" src --include=*.jsx | grep -v "pages/admin\|homeparts.jsx" | head -3)
[ -n "$BAD" ] && note "صور منتجات بتتعرض مباشرة من imageUrl من غير productImageUrl:" && printf '    %s\n' "$BAD" || ok "كل صور المنتجات بتعدّي على productImageUrl"

# 4) أسرار وملفات ممنوعة
if git rev-parse --git-dir >/dev/null 2>&1; then
  git ls-files | grep -Eiq '(^|/)\.env($|\.local)|serviceaccount|adminsdk' && fail "ملف أسرار متتبّع في Git" || ok "مفيش ملفات أسرار متتبّعة"
else note "مش Git repo: فحص الأسرار اتخطّى"; fi
[ -d seed ] && note "فولدر seed موجود: ما تشغّلش seed.mjs / catalog.mjs على موقع شغّال بيانات حقيقية (بيكتب مستندات كاملة وبيمسح صور اترفعت)"

# 5) البناء
if [ "$1" != "--no-build" ] && [ -d node_modules ]; then
  npm run build >$HOME/dw-build.log 2>&1 && ok "npm run build عدّى" || { fail "npm run build فشل (آخر سطور):"; tail -8 $HOME/dw-build.log | sed 's/^/    /'; }
fi

echo
if [ $bad -ne 0 ]; then echo "النتيجة: ✗ فيه مشاكل لازم تتصلّح قبل الإطلاق"; exit 1; fi
[ $warn -ne 0 ] && echo "النتيجة: ✓ مفيش مشاكل حرجة، وفيه ملاحظات ⚠ راجعها" || echo "النتيجة: ✓ كله تمام"
echo "بعد النشر: نفّذ الاختبارات اليدوية في docs/MANUAL-TESTS.md (بالذات اختبارات الطلب لأن الـ Rules ما اتجرّبتش على Emulator)."
