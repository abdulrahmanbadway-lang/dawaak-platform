// تبديل اللغة (عربي / English).
// الفكرة: النص العربي هو المفتاح. trs("نص عربي") بيرجّع النص نفسه في العربي، والترجمة من en.js في الإنجليزي.
// أي نص مالوش ترجمة بيظهر بالعربي (مش بيتكسر). القيم المخزّنة في Firestore (المحافظات، الحالات…) بتفضل عربي والترجمة للعرض بس.
// {0} {1} في النص بتتبدّل بالقيم من args.
import { useEffect, useState } from 'react';
import en from './en.js';

const KEY = 'dw_lang';
const read = () => { try { return localStorage.getItem(KEY) === 'en' ? 'en' : 'ar'; } catch { return 'ar'; } };
let LANG = read();
const subs = new Set();

export const getLang = () => LANG;
export const lcl = () => (LANG === 'en' ? 'en-GB' : 'ar-EG');

export function trs(key, args) {
  let s = LANG === 'en' && Object.prototype.hasOwnProperty.call(en, key) ? en[key] : key;
  if (args) s = s.replace(/\{(\d+)\}/g, (m, i) => (args[i] === undefined ? m : String(args[i])));
  return s;
}

export function applyLang(adminPage) {
  if (typeof document === 'undefined') return;
  const h = document.documentElement;
  h.lang = LANG;
  // لوحة الأدمن عربي فقط، فتفضل RTL حتى لو اللغة إنجليزي
  h.dir = LANG === 'en' && !adminPage ? 'ltr' : 'rtl';
  document.title = trs('دواك | Dawaak — منصة الصيدليات في مصر');
}

export function setLang(l) {
  const n = l === 'en' ? 'en' : 'ar';
  if (n === LANG) return;
  LANG = n;
  try { localStorage.setItem(KEY, n); } catch { /* ignore */ }
  subs.forEach((f) => f(n));
}

export function useLang() {
  const [l, set] = useState(LANG);
  useEffect(() => { subs.add(set); set(LANG); return () => { subs.delete(set); }; }, []);
  return l;
}

// ترجمة قيم بيكتبها أصحاب الصيدليات (الجرعة، مواعيد العمل، الشكل). أسماء الأدوية والصيدليات والعناوين بتفضل زي ما اتكتبت.
const NB = '(?<![\\u0600-\\u06FF])', NA = '(?![\\u0600-\\u06FF])';
const UNITS = [['ملجم', 'mg'], ['مجم', 'mg'], ['ميكروجرام', 'mcg'], ['جم', 'g'], ['جرام', 'g'], ['مل', 'ml'], ['وحدة', 'IU'], ['ساعة', 'hours'], ['ساعات', 'hours'], ['ص', 'AM'], ['م', 'PM'], ['يوميا', 'daily'], ['يومياً', 'daily'], ['قرص', 'tablet'], ['أقراص', 'tablets'], ['كبسولة', 'capsule'], ['شريط', 'strip'], ['علبة', 'box']];
export function tdata(s) {
  if (LANG !== 'en' || typeof s !== 'string' || !/[؀-ۿ]/.test(s)) return s;
  if (Object.prototype.hasOwnProperty.call(en, s)) return en[s];
  let o = s;
  for (const [a, b] of UNITS) o = o.replace(new RegExp(NB + a + NA, 'g'), b);
  return o;
}
