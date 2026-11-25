import { auth } from '../firebase.js';

// عنوان دالة الاسترجاع (Vercel). لو مش متضبط، زر الاسترجاع في لوحة الأدمن بيتعطّل.
export const RECOVERY_URL = (import.meta.env.VITE_RECOVERY_URL || '').trim();

const MSG = {
  'recent-login': 'سجّل خروج وادخل تاني كأدمن (الدخول لازم يكون خلال آخر ساعة) وجرّب',
  'not-admin': 'الحساب ده مش أدمن',
  'target-admin': 'مينفعش استرجاع حساب أدمن بالطريقة دي',
  'no-email': 'الحساب ده مالوش إيميل في Firebase Auth',
  'no-user': 'الحساب مش موجود',
  'no-auth-user': 'الحساب مش موجود في Firebase Auth',
  'rate-limited': 'محاولات كتير، استنى شوية',
  'bad-origin': 'الدالة مش مضبوطة لنطاق الموقع ده (ALLOWED_ORIGINS)',
  'not-configured': 'الدالة مش مضبوطة (مفتاح Firebase Admin ناقص)',
};

// بتطلب رابط تعيين كلمة سر لحساب (uid). بتشتغل للأدمن بس، والتحقق الفعلي على الدالة مش هنا.
export async function requestRecoveryLink(uid) {
  if (!RECOVERY_URL) throw new Error('الاسترجاع مش مفعّل (VITE_RECOVERY_URL مش متضبط)');
  const token = await auth.currentUser.getIdToken(true);
  let r;
  try { r = await fetch(RECOVERY_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ uid }) }); }
  catch { throw new Error('مفيش اتصال بدالة الاسترجاع'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(MSG[j.error] || 'تعذّر توليد الرابط (' + (j.error || r.status) + ')');
  return j; // { link, name, phone }
}
