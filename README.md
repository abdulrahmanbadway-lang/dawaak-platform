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

| prescriptions/{id} | الروشتة: patientId، pharmacyId، images (لحد 3 صور JPEG مضغوطة)، الحالة، عرض الصيدلي quote |
| prescriptions/{id}/messages/{mid} | محادثة المريض والصيدلي على الروشتة (لا تتعدل ولا تتمسح) |

## الروشتة ورد الصيدلي
1. المريض يختار الصيدلية ويرفع صورة الروشتة (`#/rx/new`). الحالة: `pending`.
2. الصيدلي يشوفها في تبويب "الروشتات" ويرد بواحدة من: عرض سعر (`quoted`) أو طلب توضيح (`need_info`) أو غير متاحة (`unavailable`).
3. المريض يأكد العرض فتتحول لطلب عادي (`ordered`) ويكمل في تتبع الطلب. الطلب والروشتة بيتكتبوا في batch واحد.

الصور بتتضغط في المتصفح وتتخزن داخل مستند Firestore (خطة Spark المجانية، من غير Storage).

## ملاحظات أمان
- الصلاحيات كلها في `firestore.rules`: المستخدم ميقدرش يغيّر دوره، والصيدلية تعدّل منتجاتها بس، والصيدلية ماتقدرش توثّق نفسها.
- توثيق الصيدليات (verified) بيتم من لوحة الأدمن في المرحلة 2.
- **اللي الـ Rules بتفرضه فعلاً (مش بس الواجهة):**
  - الروشتة: المريض بس يعملها، لصيدلية نشطة، 1-3 صور JPEG بحد أقصى للحجم، وحالتها بتبدأ `pending`.
  - الانتقالات: الصيدلي يرد بعرض/توضيح/اعتذار بس، والمريض يرد/يلغي/يأكد بس، ومفيش حذف.
  - تأكيد العرض: مينفعش إلا لو اتكتب معاه طلب مرتبط بالروشتة، أصنافه وإجماليه مطابقين للعرض بالظبط، والروشتة لسه `quoted`.
  - الطلبات: المريض بس يعملها، وانتقالات الحالة محددة (new → preparing/cancelled → out → done)، ومفيش تعديل لأي حقل غير الحالة.
  - الصيدلية متقدرش تغيّر `verified` ولا `status` ولا `license` ولا `ownerName`.
- **اللي لسه الواجهة بس اللي بتمنعه:** الطلب العادي (السلة) لأدوية الروشتة، لأن الـ Rules مش بتقدر تعدّي على عناصر الطلب وتتحقق من كل منتج. الحل الكامل محتاج Cloud Function (خطة Blaze).
- الـ Rules **لسه ما اتجربتش على الـ Emulator**: جرّبها قبل النشر (`firebase emulators:start --only firestore`).
- المحتوى إرشادي ولا يغني عن استشارة الطبيب.

## التطوير المحلي
```bash
npm install
cp .env.example .env.local   # واملأ القيم
npm run dev
```
