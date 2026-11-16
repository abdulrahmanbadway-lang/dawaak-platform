import { collection, query, where, limit, getDocs, getCountFromServer } from 'firebase/firestore';
import { db } from '../firebase.js';

// ───────── تحميل بيانات المتجر والرئيسية ─────────
// مصدر واحد للبيانات (الصيدليات + منتجات الأدوية العادية) بيتحمّل مرة واحدة ويتشارك بين الرئيسية والمتجر والمنتج والماركات،
// فمفيش قراءات مكررة. الكاش في الذاكرة وفي الجلسة (sessionStorage) 10 دقايق، وبيتمسح لما حد يعدّل منتج أو صورة (clearCatalogCache).
export const LIMITS = { catalog: 1600, pharmacies: 100, banners: 12, home: 120 };
const TTL = 10 * 60000, KEY = 'dw_cat_v2', MAX_STORE_CHARS = 3500000;
let rawP = null, rawAt = 0, grouped = null, bannerP = null, bannerAt = 0, statsP = null;

export function clearCatalogCache() {
  rawP = null; rawAt = 0; grouped = null; bannerP = null; bannerAt = 0; statsP = null;
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}

const plain = (d) => { const x = { id: d.id, ...d.data() }; delete x.createdAt; delete x.updatedAt; return x; };

async function fetchRaw(force) {
  if (!force) { try { const c = JSON.parse(sessionStorage.getItem(KEY) || 'null'); if (c && Date.now() - c.t < TTL) return c; } catch { /* ignore */ } }
  const [ps, pr] = await Promise.all([
    getDocs(query(collection(db, 'pharmacies'), limit(LIMITS.pharmacies))),
    getDocs(query(collection(db, 'products'), where('rx', '==', false), limit(LIMITS.catalog))),
  ]);
  const raw = { t: Date.now(), ph: ps.docs.map(plain), pr: pr.docs.map(plain) };
  try { const s = JSON.stringify(raw); if (s.length <= MAX_STORE_CHARS) sessionStorage.setItem(KEY, s); } catch { /* الكاش اختياري */ }
  return raw;
}
function loadRaw(force) {
  if (!force && rawP && Date.now() - rawAt < TTL) return rawP;
  rawAt = Date.now();
  rawP = fetchRaw(force).catch((e) => { rawP = null; throw e; }); // الطلب الجاري بيتشارك، وأي فشل مبيتخزّنش
  return rawP;
}

// تجميع المنتجات بالاسم (نفس المنتج عند أكتر من صيدلية)
function group(raw) {
  if (grouped?.raw === raw) return grouped.val;
  const pharmacies = {};
  raw.ph.forEach((x) => { if (x.status === 'active' && x.verified === true) pharmacies[x.id] = x; });
  const map = new Map();
  raw.pr.filter((p) => pharmacies[p.pharmacyId]).forEach((p) => {
    const g = map.get(p.nameLower) || { key: p.nameLower, name: p.name, dose: p.dose || '', form: p.form || '', ingredient: p.ingredient || '', imageUrl: '', brand: '', category: '', sub: '', description: '', warnings: '', min: Infinity, max: 0, count: 0, stock: 0, oldMax: 0, offers: [] };
    g.offers.push(p);
    if (p.stock > 0) { g.stock += p.stock; g.count++; g.min = Math.min(g.min, p.price); g.max = Math.max(g.max, p.price); if (p.oldPrice > p.price) g.oldMax = Math.max(g.oldMax, p.oldPrice); }
    for (const k of ['imageUrl', 'brand', 'category', 'sub', 'description', 'warnings', 'ingredient']) if (!g[k] && p[k]) g[k] = p[k];
    map.set(p.nameLower, g);
  });
  const products = [...map.values()].filter((g) => g.count > 0).map((g) => ({ ...g, off: g.oldMax > g.min ? Math.round((1 - g.min / g.oldMax) * 100) : 0 }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ar'));
  const val = { pharmacies, products, truncated: raw.pr.length >= LIMITS.catalog };
  grouped = { raw, val };
  return val;
}

// كتالوج كامل (للمتجر): كل منتجات الصيدليات النشطة (حد أقصى LIMITS.catalog مستند) مجمّعة بالاسم، مع القسم والماركة والعرض
export async function loadCatalog(force = false) { return group(await loadRaw(force)); }

// بيانات الرئيسية: أشهر الأصناف المتاحة + الصيدليات + الإعلانات + إحصائيات. بتشارك نفس مصدر الكتالوج (مفيش قراءة منتجات زيادة).
export async function loadHome(force = false) {
  const cat = group(await loadRaw(force));
  if (force || !bannerP || Date.now() - bannerAt > TTL) {
    bannerAt = Date.now();
    bannerP = getDocs(query(collection(db, 'banners'), limit(LIMITS.banners))).then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((b) => b.active !== false).sort((a, b) => (a.order || 0) - (b.order || 0))).catch(() => []);
  }
  const pharmacies = Object.values(cat.pharmacies);
  if (force || !statsP) {
    statsP = (async () => {
      let nProducts = cat.products.length, nPharm = pharmacies.length;
      try {
        nPharm = (await getCountFromServer(query(collection(db, 'pharmacies'), where('verified', '==', true)))).data().count;
        nProducts = (await getCountFromServer(collection(db, 'products'))).data().count;
      } catch { /* نستخدم الأعداد المحمّلة */ }
      return { pharmacies: nPharm, products: nProducts, governorates: new Set(pharmacies.map((p) => p.governorate)).size };
    })();
  }
  const [banners, stats] = await Promise.all([bannerP, statsP]);
  return { pharmacies, products: cat.products.slice(0, LIMITS.home), banners, stats };
}
