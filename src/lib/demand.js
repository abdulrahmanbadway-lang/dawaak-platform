// عدّاد مجمّع لاحتياج كل منطقة: كام مرة اتبحث/اتضاف للسلة اسم معيّن من محافظة معيّنة (من غير أي بيانات شخصية).
// بيتسجّل بس لو المستخدم حدّد منطقته، ومرة واحدة لكل كلمة في الجلسة. الأدمن بس هو اللي بيقرأه.
import { doc, setDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db, configured } from '../firebase.js';
import { getWhere } from './where.js';
import { GOV_NAMES } from './egypt.js';
import { norm } from './text.js';

const seen = new Set();
const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36); };
// k: 'q' = بحث، 'c' = إضافة للسلة
export function track(k, term) {
  try {
    const w = getWhere(); if (!configured || !w || !w.gov) return;
    const gi = GOV_NAMES.indexOf(w.gov); if (gi < 0) return;
    const t = norm(String(term || '')).slice(0, 40); if (t.length < 2) return;
    const id = `${k}_${gi}_${hash(t)}`; if (seen.has(id)) return; seen.add(id);
    setDoc(doc(db, 'demand', id), { gov: w.gov, term: t, k, n: increment(1), last: serverTimestamp() }, { merge: true }).catch(() => { /* مش خطأ للمستخدم */ });
  } catch { /* ignore */ }
}
