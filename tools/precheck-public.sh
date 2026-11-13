#!/usr/bin/env bash
# فحص قبل ما تخلي الـ Repo عام: بيدوّر على أسرار في الملفات الحالية وفي تاريخ الـ commits كله.
# الاستخدام (من فولدر المشروع):  bash tools/precheck-public.sh
# لو طلّع ✗ لا تخلّي الـ Repo عام قبل ما تتعامل معاه (اقرا الشرح اللي تحت).
cd "$(dirname "$0")/.." || exit 1
git rev-parse --git-dir >/dev/null 2>&1 || { echo "✗ ده مش Git repo. شغّل الأمر من فولدر المشروع."; exit 1; }
bad=0; warn=0
say() { printf '%s\n' "$*"; }
hit() { bad=1; say "✗ $1"; shift; for l in "$@"; do say "    $l"; done; }
note() { warn=1; say "⚠ $1"; shift; for l in "$@"; do say "    $l"; done; }

# 1) ملفات ممنوعة متتبّعة في Git (حالياً أو في التاريخ)
FILES=$(git log --all --name-only --pretty=format: 2>/dev/null | sort -u | grep -v '^$')
SEC=$(printf '%s\n' "$FILES" | grep -Ei '(^|/)\.env($|\.)|serviceaccount|service-account|firebase-adminsdk|\.pem$|\.p12$|\.key$|id_rsa|\.keystore$' | grep -v '\.env\.example$')
[ -n "$SEC" ] && hit "ملفات أسرار اتحطّت في Git في وقت ما:" $SEC
BIG=$(git ls-files -z 2>/dev/null | xargs -0 -I{} sh -c 'test -f "{}" && [ $(wc -c < "{}") -gt 5000000 ] && echo "{}"')
[ -n "$BIG" ] && note "ملفات أكبر من 5MB:" $BIG
ZIP=$(printf '%s\n' "$FILES" | grep -Ei '\.(zip|tar|tgz|gz|7z)$')
[ -n "$ZIP" ] && note "ملفات مضغوطة في التاريخ (ممكن تكون فيها نسخ احتياطية فيها أسرار):" $ZIP

# 2) أنماط أسرار جوه محتوى الملفات (الحالية + كل التاريخ)
scan() { # $1 وصف  $2 regex
  local out
  out=$(git grep -I -nE "$2" $(git rev-list --all 2>/dev/null | head -400) -- . ':!package-lock.json' ':!seed/images.json' ':!*.png' 2>/dev/null | grep -v '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6' | cut -c1-160 | head -8)
  [ -n "$out" ] && hit "$1" "$out"
  # بيانات تسجيل الدخول العامة بتاعة Firebase CLI (موجودة في كود firebase-tools المفتوح المصدر، مش سر بتاعك): تحذير بس
  if git grep -I -qE '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6' $(git rev-list --all 2>/dev/null | head -400) -- seed 2>/dev/null && [ "$K1" != 1 ]; then K1=1
    note "تاريخ الـ commits القديم فيه بيانات OAuth العامة بتاعة Firebase CLI (seed/lib.mjs). دي مش سر بتاعك (موجودة في firebase-tools المفتوح)، والنسخة الحالية بقت بتقراها من الجهاز. ينفع تكمّل."
  fi
}
scan "مفتاح خاص (private key) في الكود:" 'BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY|"private_key"[[:space:]]*:'
scan "Token أو سر معروف الشكل (GitHub/Google OAuth/Slack/AWS):" 'ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|ya29\.[A-Za-z0-9_-]{30,}|xox[baprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|1//0[A-Za-z0-9_-]{30,}'
scan "كلمة سر مكتوبة صراحةً:" '(^|[^A-Za-z_-])(password|passwd|client_secret|api_?secret|secret_?key)["'"'"']?[[:space:]]*[:=][[:space:]]*["'"'"'][^"'"'"'$ {}]{6,}["'"'"']'
# مفاتيح Firebase الويب (AIza...) مش سرية بطبيعتها، لكن نفضّل تفضل في .env مش في الكود
K=$(git grep -I -nE 'AIza[0-9A-Za-z_-]{30,}' $(git rev-list --all 2>/dev/null | head -400) -- . 2>/dev/null | cut -c1-120 | head -4)
[ -n "$K" ] && note "مفتاح Firebase ويب (AIza…) مكتوب في الكود/التاريخ. ده مش سر خطير (الحماية الحقيقية في firestore.rules) لكن الأفضل يفضل في .env:" "$K"

# 3) إيميلات حقيقية في الكود (غير إيميلات العرض)
E=$(git grep -I -nEho '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' -- . ':!package-lock.json' ':!seed/images.json' 2>/dev/null | sort -u | grep -viE '@(dawaak\.test|example\.(com|org)|users\.noreply\.github\.com)$|noreply' | head -10)
[ -n "$E" ] && note "إيميلات في الكود (اتأكد إنك عايزها تظهر للعامة):" $E

say ""
if [ $bad -eq 1 ]; then
  say "══ ✗ لسه مش جاهز. الحل:"
  say "  1) لو السر حقيقي (باسورد/Token/مفتاح خاص): غيّره فوراً من مصدره (Firebase/GitHub/Google) لأن حذفه من الكود مش بيشيله من التاريخ."
  say "  2) امسحه من التاريخ (git filter-repo أو BFG) أو اعمل Repo جديد نضيف بآخر نسخة من الكود بس."
  say "  3) شغّل الفحص تاني لحد ما يطلع ✓."
  exit 1
fi
[ $warn -eq 1 ] && say "══ ✓ مفيش أسرار خطيرة، بس راجع التحذيرات اللي فوق."
[ $warn -eq 0 ] && say "══ ✓ مفيش أسرار ظاهرة. ينفع تخلّي الـ Repo عام."
