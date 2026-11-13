import { collection, query, where, limit, getDocs, getCountFromServer } from 'firebase/firestore';
import { db } from '../firebase.js';

let cache = null;
// بيانات الرئيسية: أصناف متاحة (مجمّعة بالاسم) + الصيدليات + إحصائيات حقيقية
export async function loadHome(force = false) {
  if (cache && !force) return cache;
  const [ps, pr, bn] = await Promise.all([
    getDocs(query(collection(db, 'pharmacies'), limit(50))),
    getDocs(query(collection(db, 'products'), where('rx', '==', false), limit(120))),
    getDocs(query(collection(db, 'banners'), limit(12))).catch(() => ({ docs: [] })),
  ]);
  const banners = bn.docs.map((d) => ({ id: d.id, ...d.data() })).filter((b) => b.active !== false).sort((a, b) => (a.order || 0) - (b.order || 0));
  const pharmacies = ps.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => p.status === 'active' && p.verified === true);
  const ok = new Set(pharmacies.map((p) => p.id));
  const map = new Map();
  pr.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => ok.has(p.pharmacyId) && p.stock > 0).forEach((p) => {
    const g = map.get(p.nameLower) || { name: p.name, dose: p.dose, form: p.form, category: p.category || '', imageUrl: p.imageUrl, min: Infinity, max: 0, count: 0 };
    g.min = Math.min(g.min, p.price); g.max = Math.max(g.max, p.price); g.count++;
    if (!g.imageUrl && p.imageUrl) g.imageUrl = p.imageUrl;
    if (!g.category && p.category) g.category = p.category;
    map.set(p.nameLower, g);
  });
  const products = [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ar'));
  let nProducts = products.length, nPharm = pharmacies.length;
  try {
    nPharm = (await getCountFromServer(query(collection(db, 'pharmacies'), where('verified', '==', true)))).data().count;
    nProducts = (await getCountFromServer(collection(db, 'products'))).data().count;
  } catch { /* نستخدم الأعداد المحمّلة */ }
  cache = { pharmacies, products, banners, stats: { pharmacies: nPharm, products: nProducts, governorates: new Set(pharmacies.map((p) => p.governorate)).size } };
  return cache;
}

// كتالوج كامل (للمتجر): كل منتجات الصيدليات النشطة (حد أقصى 400 مستند) مجمّعة بالاسم، مع القسم والماركة والعرض
let catCache = null, catAt = 0;
export async function loadCatalog(force = false) {
  if (catCache && !force && Date.now() - catAt < 300000) return catCache;
  const [ps, pr] = await Promise.all([
    getDocs(query(collection(db, 'pharmacies'), limit(100))),
    getDocs(query(collection(db, 'products'), where('rx', '==', false), limit(400))),
  ]);
  const pharmacies = {};
  ps.docs.forEach((d) => { const x = { id: d.id, ...d.data() }; if (x.status === 'active' && x.verified === true) pharmacies[d.id] = x; });
  const offers = pr.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => pharmacies[p.pharmacyId]);
  const map = new Map();
  offers.forEach((p) => {
    const g = map.get(p.nameLower) || { key: p.nameLower, name: p.name, dose: p.dose || '', form: p.form || '', ingredient: p.ingredient || '', imageUrl: '', brand: '', category: '', sub: '', description: '', warnings: '', min: Infinity, max: 0, count: 0, stock: 0, oldMax: 0, offers: [] };
    g.offers.push(p);
    if (p.stock > 0) { g.stock += p.stock; g.count++; g.min = Math.min(g.min, p.price); g.max = Math.max(g.max, p.price); if (p.oldPrice > p.price) g.oldMax = Math.max(g.oldMax, p.oldPrice); }
    for (const k of ['imageUrl', 'brand', 'category', 'sub', 'description', 'warnings', 'ingredient']) if (!g[k] && p[k]) g[k] = p[k];
    map.set(p.nameLower, g);
  });
  const products = [...map.values()].filter((g) => g.count > 0).map((g) => ({ ...g, off: g.oldMax > g.min ? Math.round((1 - g.min / g.oldMax) * 100) : 0 }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ar'));
  catCache = { pharmacies, products };
  catAt = Date.now();
  return catCache;
}
