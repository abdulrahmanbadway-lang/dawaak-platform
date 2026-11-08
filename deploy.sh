#!/usr/bin/env bash
# تحديث الموقع: بيبني، وينشر على Firebase، ويرفع الكود على GitHub.   الاستخدام: bash deploy.sh "رسالة التعديل"
set -e
cd "$(dirname "$0")"
npm install --no-audit --no-fund
npm run build
firebase deploy --only firestore:rules,hosting
git add -A && git commit -m "${1:-update}" || true
git push || true
echo "✓ https://$(grep -o '"default": *"[^"]*"' .firebaserc | cut -d'"' -f4).web.app"
