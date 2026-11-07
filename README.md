# دواك | Dawaak — منصة تربط صيدليات مصر

مشروع تخرج · Al-Gazeera Academy · Class of 2027 Graduates

## الفكرة
- **الصيدلية**: تسجّل حساب، تضيف أدويتها (الاسم، المادة الفعالة، الجرعة، السعر، الكمية، الصورة، التفاصيل)، وتستقبل الطلبات وتتابعها.
- **المريض**: يبحث عن الدوا، فيشوف الصيدليات اللي عندها الدوا مرتبة بالأقرب، يطلب، ويتابع حالة طلبه.
- (المرحلة 2) الروشتة، الاستشارة مع الصيدلي، أسئلة التشخيص المبدئي، متابعة الحالة، وتوثيق الصيدليات من الأدمن.

## التقنيات
React 18 + Vite · Firebase (Authentication + Firestore) · Vercel

## التشغيل خطوة بخطوة

### 1) مشروع Firebase
1. من console.firebase.google.com اعمل مشروع جديد.
2. **Authentication** ثم Sign-in method: فعّل **Email/Password**.
3. **Firestore Database**: اعمل قاعدة بيانات (Production mode)، وبعدين تبويب **Rules**: امسح الموجود والصق محتوى ملف `firestore.rules` واضغط Publish.
4. **Project settings** ثم Your apps ثم Web app: انسخ قيم الإعداد (apiKey, authDomain, projectId, appId).

### 2) Vercel
1. ارفع المشروع على GitHub (الملفات كلها ما عدا node_modules).
2. من vercel.com: Add New Project ثم اختار الـ Repository. الـ Framework هيتعرف لوحده (Vite).
3. قبل Deploy: Environment Variables وضيف:
   - VITE_FIREBASE_API_KEY
   - VITE_FIREBASE_AUTH_DOMAIN
   - VITE_FIREBASE_PROJECT_ID
   - VITE_FIREBASE_APP_ID
4. Deploy. (لو ضفت المتغيرات بعد أول Deploy اعمل Redeploy.)
5. في Firebase: Authentication ثم Settings ثم Authorized domains: ضيف دومين Vercel بتاعك.

### 3) صور المنتجات
- الافتراضي: الصورة بتتضغط في المتصفح (حوالي 420px) وبتتحفظ داخل Firestore، ومش محتاج Storage ولا بطاقة بنكية.
- لو عايز Firebase Storage: فعّله (ممكن يحتاج خطة Blaze)، والصق `storage.rules`، وحط `VITE_USE_STORAGE=1` و `VITE_FIREBASE_STORAGE_BUCKET`.

## نموذج البيانات (Firestore)
| المجموعة | الوصف |
|---|---|
| users/{uid} | الاسم، البريد، الدور (patient أو pharmacy) |
| pharmacies/{uid} | بيانات الصيدلية، الموقع lat/lng، مفتوحة/مغلقة، verified |
| products/{id} | pharmacyId، الاسم، المادة الفعالة، الجرعة، السعر، الكمية، rx، الصورة، التفاصيل |
| orders/{id} | patientId، pharmacyId، العناصر، الإجمالي، الحالة |

## ملاحظات أمان
- الصلاحيات كلها في `firestore.rules`: المستخدم ميقدرش يغيّر دوره، والصيدلية تعدّل منتجاتها بس، والصيدلية ماتقدرش توثّق نفسها.
- توثيق الصيدليات (verified) بيتم من لوحة الأدمن في المرحلة 2.
- طلب الأدوية اللي بتحتاج روشتة متوقف لحد ما نضيف رفع الروشتة ومراجعة الصيدلي.
- المحتوى إرشادي ولا يغني عن استشارة الطبيب.

## التطوير المحلي
```bash
npm install
cp .env.example .env.local   # واملأ القيم
npm run dev
```
