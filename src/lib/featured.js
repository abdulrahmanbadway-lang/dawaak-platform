import { collection, query, where, limit, getDocs, getCountFromServer } from 'firebase/firestore';
import { db } from '../firebase.js';

let cache = null;
// بيانات الرئيسية: أصناف متاحة (مجمّعة بالاسم) + الصيدليات + إحصائيات حقيقية
export async function loadHome(force = false) {
  if (cache && !force) return cache;
  const [ps, pr] = await Promise.all([
    getDocs(query(collection(db, 'pharmacies'), limit(50))),
    getDocs(query(collection(db, 'products'), where('rx', '==', false), limit(120))),
  ]);
  const pharmacies = ps.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => p.status === 'active');
  const ok = new Set(pharmacies.map((p) => p.id));
  const map = new Map();
  pr.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => ok.has(p.pharmacyId) && p.stock > 0).forEach((p) => {
    const g = map.get(p.nameLower) || { name: p.name, dose: p.dose, form: p.form, imageUrl: p.imageUrl, min: Infinity, max: 0, count: 0 };
    g.min = Math.min(g.min, p.price); g.max = Math.max(g.max, p.price); g.count++;
    if (!g.imageUrl && p.imageUrl) g.imageUrl = p.imageUrl;
    map.set(p.nameLower, g);
  });
  const products = [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ar'));
  let nProducts = products.length, nPharm = pharmacies.length;
  try {
    nPharm = (await getCountFromServer(collection(db, 'pharmacies'))).data().count;
    nProducts = (await getCountFromServer(collection(db, 'products'))).data().count;
  } catch { /* نستخدم الأعداد المحمّلة */ }
  cache = { pharmacies, products, stats: { pharmacies: nPharm, products: nProducts, governorates: new Set(pharmacies.map((p) => p.governorate)).size } };
  return cache;
}
