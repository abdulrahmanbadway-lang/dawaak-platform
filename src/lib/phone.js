// أرقام الموبايل المصرية: بنقبل أرقام عربية/هندية و +20 و 0020 و 20 وبنوحّدها على 01XXXXXXXXX
const D = { '٠': 0, '١': 1, '٢': 2, '٣': 3, '٤': 4, '٥': 5, '٦': 6, '٧': 7, '٨': 8, '٩': 9, '۰': 0, '۱': 1, '۲': 2, '۳': 3, '۴': 4, '۵': 5, '۶': 6, '۷': 7, '۸': 8, '۹': 9 };
export const PHONE_RE = /^01[0125]\d{8}$/;
export function normPhone(s) {
  let t = String(s ?? '').replace(/[٠-٩۰-۹]/g, (c) => D[c]).replace(/[\s\-().]/g, '');
  if (t.startsWith('+')) t = t.slice(1);
  if (t.startsWith('0020')) t = t.slice(4);
  if (t.startsWith('20') && t.length === 12) t = t.slice(2);
  if (/^1[0125]\d{8}$/.test(t)) t = '0' + t;
  return t;
}
export const isPhone = (s) => PHONE_RE.test(normPhone(s));
// مدخل تسجيل الدخول: إيميل (فيه @) ولا رقم؟
export const kindOf = (s) => (String(s).includes('@') ? 'email' : 'phone');
