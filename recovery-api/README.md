# recovery-api — استرجاع الحسابات لمّا العميل ينسى الإيميل

دالة صغيرة (Vercel، مجانية) بتخلّي **الأدمن** يولّد رابط تعيين كلمة سر لأي مستخدم (مش أدمن) ويبعته له على واتساب من لوحة التحكم.
Firebase المجاني (Spark) مفيهوش Cloud Functions، عشان كده الدالة دي بتشتغل برّه على Vercel.

## الأمان
- مفتاح الخدمة (service account) بيتحط **في إعدادات Vercel بس**، مش في الكود ولا في GitHub ولا في الموقع.
- الدالة بتتحقق إن اللي بيطلب أدمن فعلًا (توكن Firebase + `users/{uid}.role == 'admin'` + مش محظور)، وإن دخوله كان في آخر ساعة.
- ممنوع تسترجع حساب أدمن. حد أقصى 10 طلبات كل 10 دقايق. كل عملية بتتسجّل في collection اسمه `recoveryAudit`.
- الرابط صالح ساعة تقريبًا ولمرة واحدة.

## خطوات التركيب (مرة واحدة، من المتصفح)
1. **مفتاح الخدمة:** Firebase Console ← Project settings ← Service accounts ← *Generate new private key* (ينزل ملف JSON). ماتبعتوش لأي حد.
2. حوّل الملف لـ base64 (في Termux): `base64 -w0 ملف.json` وانسخ الناتج. بعدها امسح الملف من التنزيلات.
3. على vercel.com: *Add New → Project* ← اختار ريبو `dawaak-platform` ← **Root Directory = `recovery-api`** ← Deploy.
4. في Vercel ← Settings ← Environment Variables ضيف:
   - `FIREBASE_SERVICE_ACCOUNT_B64` = الناتج من الخطوة 2
   - `SITE_URL` = `https://dawaak-i74iqp.web.app`
   - `ALLOWED_ORIGINS` = `https://dawaak-i74iqp.web.app`
   ثم *Redeploy*.
5. في مشروع الموقع ضيف في `.env.local`:
   `VITE_RECOVERY_URL=https://<اسم-مشروعك>.vercel.app/api/recover`
   وبعدين `bash deploy.sh "recovery"` (بيعمل build من جديد).

## الاستخدام
لوحة الأدمن ← المستخدمين ← زر **استرجاع** جنب المستخدم ← *توليد الرابط* ← **ابعته على واتساب**.
(لازم تكون عامل تسجيل دخول في آخر ساعة، لو ظهر خطأ اخرج وادخل تاني.)

## اختبار محلي
`cd recovery-api && npm install && node test.js` (12 اختبار بدون اتصال بالإنترنت).
