// بيانات التواصل بتاعة الموقع (بيحدّدها الأدمن من لوحة التحكم، تبويب "التواصل"): settings/contact
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase.js';

let cache;
export const loadContact = () => (cache || (cache = getDoc(doc(db, 'settings', 'contact')).then((s) => (s.exists() ? s.data() : {})).catch(() => ({}))));
export const resetContact = () => { cache = undefined; };
const digits = (s) => String(s || '').replace(/[^0-9]/g, '');
// رقم مصري بيبدأ بـ 0 → كود الدولة 20 (واتساب بيحتاج الرقم الدولي من غير + أو 00)
export const waNumber = (s) => { let d = digits(s); if (d.startsWith('00')) d = d.slice(2); else if (d.startsWith('0')) d = '20' + d.slice(1); return d; };
export const waLink = (s, text) => `https://wa.me/${waNumber(s)}${text ? '?text=' + encodeURIComponent(text) : ''}`;
export const telLink = (s) => 'tel:+' + waNumber(s);
