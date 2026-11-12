// بيانات العرض (دكاترة/صيدليات + مناديب + مرضى + منتجات بصور + طلبات + روشتات + بانرات) + أدوات Google REST (بدون مكتبات خارجية)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PRODUCTS } from './data.mjs';
import { GOV_NAMES } from '../src/lib/egypt.js';

// كلمة السر مش مكتوبة في الكود: من DW_PASSWORD لو حطيتها، أو بتتولّد عشوائي كل مرة وتتطبع في الآخر
const ALPHA = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const PASSWORD = process.env.DW_PASSWORD || Array.from(crypto.randomBytes(10), (b) => ALPHA[b % ALPHA.length]).join('') + '#7';
const FS = process.env.DW_FS || 'https://firestore.googleapis.com';
const IDT = process.env.DW_IDT || 'https://identitytoolkit.googleapis.com';
const TOKEN_URL = process.env.DW_TOKEN_URL || 'https://oauth2.googleapis.com/token';
const IMG = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'images.json'), 'utf8'));

// نفس دالة التوحيد المستخدمة في التطبيق (src/lib/text.js)
export const norm = (s = '') => s.toString().trim().toLowerCase()
  .replace(/[ً-ٟ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ');

// الدكاترة (الصيادلة) أصحاب الصيدليات
export const PHARMACIES = [
  { n: 'صيدلية النور', c: 'وسط البلد', o: 'د. أحمد سمير', g: 'القاهرة', a: 'شارع قصر النيل، وسط البلد', lat: 30.0455, lng: 31.239, h: '9 ص – 12 م', v: true, open: true },
  { n: 'صيدلية الحياة', c: 'مدينة نصر', o: 'د. منى حسن', g: 'القاهرة', a: 'شارع عباس العقاد، مدينة نصر', lat: 30.0626, lng: 31.33, h: '24 ساعة', v: true, open: true },
  { n: 'صيدلية السلام', c: 'الدقي', o: 'د. كريم عادل', g: 'الجيزة', a: 'شارع التحرير، الدقي', lat: 30.0381, lng: 31.2113, h: '8 ص – 1 ص', v: true, open: true },
  { n: 'صيدلية الشفاء', c: 'المهندسين', o: 'د. هدى فاروق', g: 'الجيزة', a: 'شارع جامعة الدول العربية، المهندسين', lat: 30.0553, lng: 31.2002, h: '10 ص – 11 م', v: true, open: true },
  { n: 'صيدلية الأمل', c: 'سموحة', o: 'د. طارق مصطفى', g: 'الإسكندرية', a: 'شارع سموحة الرئيسي', lat: 31.2156, lng: 29.9422, h: '9 ص – 2 ص', v: true, open: true },
  { n: 'صيدلية المحبة', c: 'المنصورة', o: 'د. نهى إبراهيم', g: 'الدقهلية', a: 'شارع الجلاء، المنصورة', lat: 31.0409, lng: 31.3785, h: '9 ص – 11 م', v: false, open: true },
  { n: 'صيدلية الرحمة', c: 'طنطا', o: 'د. ياسر محمود', g: 'الغربية', a: 'شارع الجيش، طنطا', lat: 30.7865, lng: 31.0004, h: '24 ساعة', v: false, open: true },
  { n: 'صيدلية الصعيد', c: 'أسيوط', o: 'د. سلمى عبد الله', g: 'أسيوط', a: 'شارع الجمهورية، أسيوط', lat: 27.1783, lng: 31.1859, h: '9 ص – 12 م', v: true, open: false },
];
// المناديب: اتنين لكل صيدلية من أول 4
const CN = ['محمود السيد', 'إسلام جمال', 'أيمن رشاد', 'مصطفى عوض', 'حسام الدين', 'عمرو فتحي', 'باسم نبيل', 'خالد منصور'];
export const COURIERS = CN.map((name, i) => ({ key: 'c' + (i + 1), name, ph: Math.floor(i / 2), phone: `0111000${String(2100 + i)}` }));
// المرضى (بعناوين وإحداثيات قريبة من الصيدليات)
export const PATIENTS = [
  { key: 'p1', name: 'عبدالرحمن بدوي', phone: '01012345601', addr: '٥ شارع النيل، الدقي، الجيزة', lat: 30.0395, lng: 31.2124 },
  { key: 'p2', name: 'سارة محمد', phone: '01012345602', addr: '١٢ شارع التحرير، وسط البلد، القاهرة', lat: 30.0489, lng: 31.2432 },
  { key: 'p3', name: 'مصطفى كامل', phone: '01012345603', addr: '٢٠ شارع مصطفى النحاس، مدينة نصر', lat: 30.0645, lng: 31.3402 },
  { key: 'p4', name: 'نورهان أحمد', phone: '01012345604', addr: '٨ شارع شهاب، المهندسين، الجيزة', lat: 30.0562, lng: 31.2065 },
  { key: 'p5', name: 'يوسف إبراهيم', phone: '01012345605', addr: '٣ شارع عبد السلام عارف، سموحة، الإسكندرية', lat: 31.2171, lng: 29.9481 },
  { key: 'p6', name: 'مريم خالد', phone: '01012345606', addr: '٢٢ شارع الجلاء، المنصورة', lat: 31.0432, lng: 31.3809 },
];
export const ACCOUNTS = [
  ...PHARMACIES.map((p, i) => ({ key: 'ph' + (i + 1), email: `ph${i + 1}@dawaak.test`, name: p.o, role: 'pharmacy' })),
  ...COURIERS.map((c) => ({ key: c.key, email: `${c.key}@dawaak.test`, name: c.name, role: 'courier' })),
  ...PATIENTS.map((p) => ({ key: p.key, email: `${p.key}@dawaak.test`, name: p.name, role: 'patient' })),
];
export const idOf = { prod: (i, k) => `seed-${i + 1}-${k}`, order: (n) => `seed-order-${n}`, rx: (n) => `seed-rx-${n}` };

// طلبات العرض: [رقم، مريض، صيدلية(0-based)، حالة، من كام ساعة، [[منتج، كمية]]، مندوب(اختياري)]
export const ORDERS = [
  [1, 'p1', 0, 'new', 0.1, [['claritine', 1], ['vit-c-1000', 1]]],
  [2, 'p2', 0, 'new', 0.3, [['panadol-extra', 2], ['strepsils', 1]]],
  [3, 'p4', 3, 'new', 0.5, [['cetaphil-clean', 1], ['lrp-spf50', 1]]],
  [4, 'p3', 1, 'preparing', 1.2, [['brufen-400', 1], ['betadine', 1], ['bandage', 1]]],
  [5, 'p5', 4, 'preparing', 2, [['pampers-4', 1], ['cerelac', 2]]],
  [6, 'p1', 0, 'out', 0.8, [['voltaren-emulgel', 1], ['panadol-extra', 1]], 'c1'],
  [7, 'p4', 3, 'out', 0.6, [['centrum', 1], ['omega3', 1]], 'c7'],
  [8, 'p2', 0, 'done', 26, [['gaviscon', 1], ['antinal', 1]], 'c2'],
  [9, 'p3', 1, 'done', 50, [['omron-bp', 1]], 'c3'],
  [10, 'p1', 0, 'done', 80, [['vit-c-1000', 2], ['centrum', 1]], 'c1'],
  [11, 'p6', 5, 'done', 100, [['nivea-soft', 1], ['head-shoulders', 1]]],
  [12, 'p4', 3, 'done', 130, [['sensodyne', 1], ['colgate', 2], ['oralb', 1]], 'c8'],
  [13, 'p2', 0, 'done', 170, [['cetaphil-clean', 1], ['eucerin-cream', 1]], 'c2'],
  [14, 'p3', 1, 'done', 220, [['accuchek', 1], ['thermo', 1]], 'c4'],
  [15, 'p5', 4, 'cancelled', 30, [['zyrtec', 1]]],
  [16, 'p1', 0, 'cancelled', 150, [['buscopan', 1]]],
];
const need = new Set(); // منتجات لازم تتوفر في الصيدلية عشان الطلبات
ORDERS.forEach((o) => o[5].forEach(([k]) => need.add(o[2] + ':' + k)));
['glucophage-500', 'concor-5', 'vit-d3', 'augmentin-1g', 'panadol-cold', 'otrivin', 'ventolin', 'zyrtec'].forEach((k) => { need.add('0:' + k); need.add('1:' + k); });

function rng(seed) { // mulberry32
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// حالات ثابتة للعرض: بنادول نفد في الدقي، وكمية قليلة في مدينة نصر
const FORCE = { 'panadol-extra': { 1: 2, 2: 0 }, 'vit-c-1000': { 1: 0 } };

// uid(key) -> uid الحقيقي للحساب. بيرجّع قائمة مستندات {path, data}
export function buildDocs(uid) {
  const docs = [], now = Date.now(), H = 36e5, D = (ms) => new Date(now - ms), inv = PHARMACIES.map(() => ({}));
  const add = (p, data) => docs.push({ path: p, data });
  ACCOUNTS.forEach((a) => add(`users/${uid(a.key)}`, { name: a.name, email: a.email, role: a.role, createdAt: D(20 * 864e5), seed: true }));
  PHARMACIES.forEach((p, i) => {
    const id = uid('ph' + (i + 1));
    add(`pharmacies/${id}`, { name: p.n, ownerName: p.o, license: `EG-PH-${1001 + i}`, phone: `0100000${String(1010 + i)}`, governorate: p.g, city: p.c, address: p.a, hours: p.h, lat: p.lat, lng: p.lng, open: p.open, status: 'active', verified: p.v, createdAt: D(30 * 864e5), seed: true });
    const r = rng(101 + i * 7), keep = i < 4 ? 0.5 : 0.3;
    PRODUCTS.forEach((pr) => {
      const r1 = r(), r2 = r(), r3 = r(), r4 = r();
      if (!need.has(i + ':' + pr.k) && r1 > keep) return;
      const price = Math.max(5, Math.round(pr.price * (0.94 + r2 * 0.12)));
      let stock = r3 < 0.1 ? 0 : r3 < 0.25 ? 1 + Math.floor(r4 * 4) : 5 + Math.floor(r4 * 56);
      if (FORCE[pr.k]?.[i] !== undefined) stock = FORCE[pr.k][i];
      if (need.has(i + ':' + pr.k) && stock < 5) stock = 20;
      let oldPrice = 0;
      if (pr.oldPrice && r1 < 0.8) { oldPrice = Math.round(price * pr.oldPrice / pr.price); if (oldPrice <= price) oldPrice = price + 5; }
      const d = { pharmacyId: id, name: pr.name, nameLower: norm(pr.name), ingredient: pr.ing, ingredientLower: norm(pr.ing), dose: pr.dose, form: pr.form, price, stock, rx: pr.rx, description: pr.desc, warnings: pr.warn, imageUrl: IMG.products[pr.k], category: pr.category, sub: pr.sub, brand: pr.brand, ...(oldPrice ? { oldPrice } : {}), createdAt: D((3 + Math.floor(r4 * 25)) * 864e5), seed: true };
      add(`products/${idOf.prod(i, pr.k)}`, d);
      inv[i][pr.k] = { id: idOf.prod(i, pr.k), ...d };
    });
  });
  COURIERS.forEach((c) => add(`couriers/${uid(c.key)}`, { pharmacyId: uid('ph' + (c.ph + 1)), name: c.name, phone: c.phone, active: true, createdAt: D(15 * 864e5) }));
  const pat = Object.fromEntries(PATIENTS.map((p) => [p.key, p])), cour = Object.fromEntries(COURIERS.map((c) => [c.key, c]));
  ORDERS.forEach(([n, pk, pi, status, hrs, lines, ck]) => {
    const p = pat[pk], ph = PHARMACIES[pi], items = lines.map(([k, qty]) => ({ productId: inv[pi][k].id, name: inv[pi][k].name, dose: inv[pi][k].dose || '', price: inv[pi][k].price, qty }));
    const total = items.reduce((s, x) => s + x.price * x.qty, 0), t = D(hrs * H), u = D(Math.max(0, hrs - 0.2) * H);
    const c = ck && ['out', 'done'].includes(status) ? cour[ck] : null;
    add(`orders/${idOf.order(n)}`, { patientId: uid(pk), patientName: p.name, phone: p.phone, address: p.addr, note: n % 3 === 0 ? 'من فضلك الاتصال قبل الوصول' : '', pharmacyId: uid('ph' + (pi + 1)), pharmacyName: ph.n, items, total, status, createdAt: t, updatedAt: u, dest: { lat: p.lat, lng: p.lng }, ...(c ? { courierId: uid(c.key), courierName: c.name, courierPhone: c.phone } : {}), seed: true });
    if (status === 'out' && c) { // موقع المندوب الحالي: بين الصيدلية والمريض (simulate.mjs بيحرّكه)
      const f = 0.45; add(`tracking/${idOf.order(n)}`, { courierId: uid(c.key), lat: +(ph.lat + (p.lat - ph.lat) * f).toFixed(6), lng: +(ph.lng + (p.lng - ph.lng) * f).toFixed(6), acc: 12, speed: 6.2, heading: 90, updatedAt: new Date(now) });
    }
  });
  // الروشتات
  const line = (pi, k, qty) => ({ productId: inv[pi][k].id, name: inv[pi][k].name, dose: inv[pi][k].dose || '', price: inv[pi][k].price, qty });
  const rx = (n, pk, pi, status, hrs, img, note, extra = {}) => add(`prescriptions/${idOf.rx(n)}`, { patientId: uid(pk), patientName: pat[pk].name, pharmacyId: uid('ph' + (pi + 1)), pharmacyName: PHARMACIES[pi].n, phone: pat[pk].phone, address: pat[pk].addr, note, images: [IMG.rx[img]], dest: { lat: pat[pk].lat, lng: pat[pk].lng }, status, createdAt: D(hrs * H), updatedAt: D(Math.max(0, hrs - 0.3) * H), ...extra });
  rx(1, 'p1', 0, 'pending', 0.4, 0, 'محتاج الأدوية دي النهاردة لو متاحة');
  const q = [line(0, 'glucophage-500', 2), line(0, 'concor-5', 1), line(0, 'vit-d3', 1)];
  rx(2, 'p2', 0, 'quoted', 3, 1, 'روشتة الباطنة', { quote: { items: q.map(({ productId, name, dose, price, qty }) => ({ productId, name, dose, price, qty })), total: q.reduce((s, x) => s + x.price * x.qty, 0), note: 'الأصناف كلها متوفرة، والتوصيل خلال ساعة.' } });
  rx(3, 'p3', 1, 'need_info', 5, 2, '');
  const msg = (n, m, who, uidk, text, ago) => add(`prescriptions/${idOf.rx(n)}/messages/seed-m${m}`, { senderId: uid(uidk), role: who, text, createdAt: D(ago * H) });
  msg(3, 1, 'pharmacy', 'ph2', 'أهلاً، هل لديك حساسية من أي دواء؟ وهل الفنتولين للاستخدام الدائم؟', 4.5);
  msg(3, 2, 'patient', 'p3', 'مفيش حساسية، والبخاخ للاستخدام عند اللزوم بس.', 4.2);
  // البانرات (الأدمن بيعدلها من لوحة التحكم)
  [['عروض الأسبوع', 'خصومات على أكتر من 40 صنف من الصيدليات القريبة منك', '#/shop?offers=1'], ['ارفع روشتتك', 'الصيدلي هيرد عليك بالأصناف والأسعار قبل ما تأكد', '#/rx/new'], ['كل احتياجات طفلك', 'حفاضات وأغذية ورعاية بتوصل لحد باب البيت', '#/shop']]
    .forEach(([title, sub, link], i) => add(`banners/seed-b${i + 1}`, { title, sub, link, imageUrl: IMG.banners[i], order: i + 1, active: true, createdAt: D((3 - i) * 864e5) }));
  // مناطق المستخدمين واحتياج كل منطقة (أرقام تجريبية للعرض بتتمسح مع clear.mjs)
  const GOVP = { p1: ['الجيزة', 30.04, 31.21], p2: ['القاهرة', 30.05, 31.24], p3: ['القاهرة', 30.06, 31.34], p4: ['الجيزة', 30.06, 31.2], p5: ['الإسكندرية', 31.22, 29.95], p6: ['الدقهلية', 31.04, 31.38] };
  PATIENTS.forEach((p, i) => { const [gov, lat, lng] = GOVP[p.key]; add(`presence/${uid(p.key)}`, { uid: uid(p.key), path: ['/', '/shop', '/orders', '/search', '/cart', '/'][i], dev: 'Android · Chrome', mobile: true, cc: 'EG', gov, lat, lng, since: now - 3 * H, lastSeen: D((i + 1) * 4 * 6e4) }); });
  [['الإسكندرية', 31.2, 29.92], ['الجيزة', 29.98, 31.13], ['القاهرة', 30.03, 31.47], ['الدقهلية', 31.05, 31.37], ['أسيوط', 27.18, 31.19], ['الأقصر', 25.69, 32.64], ['القاهرة', 30.0, 31.29], ['الشرقية', 30.59, 31.5]].forEach(([gov, lat, lng], i) => add(`presence/v_seed${i + 1}`, { uid: null, sid: `v_seed${i + 1}`, path: '/shop', dev: i % 2 ? 'Windows · Chrome' : 'Android · Chrome', mobile: i % 2 === 0, cc: 'EG', gov, lat, lng, since: now - 2 * H, lastSeen: D((i + 2) * 7 * 6e4) }));
  const DEM = { 'القاهرة': { q: [['بنادول', 22], ['فيتامين سي', 15], ['سيتافيل', 9], ['كلاريتين', 7]], c: [['بنادول إكسترا', 8], ['سنتروم', 5], ['أومرون جهاز قياس ضغط', 3]] },
    'الجيزة': { q: [['بنادول كولد', 18], ['زيرتك', 11], ['فولتارين', 8], ['ميزان حرارة', 6]], c: [['بنادول كولد آند فلو', 7], ['فولتارين إميلجيل', 5]] },
    'الإسكندرية': { q: [['بامبرز', 14], ['سيريلاك', 10], ['واقي شمس', 9], ['بيبانثين', 6]], c: [['بامبرز مقاس 4', 6], ['جونسون شامبو أطفال', 4]] },
    'الدقهلية': { q: [['جلوكوفاج', 9], ['شرائط سكر', 8], ['كونكور', 5]], c: [['أكيو تشيك شرائط سكر', 4]] },
    'أسيوط': { q: [['فيتامين د', 6], ['أوميجا 3', 4]], c: [['فيتامين د3 5000', 2]] } };
  Object.entries(DEM).forEach(([gov, d]) => ['q', 'c'].forEach((k) => (d[k] || []).forEach(([term, n], i) => add(`demand/${k}_${GOV_NAMES.indexOf(gov)}_seed${i}`, { gov, term, k, n, last: D((i + 1) * H) }))));
  return docs;
}

// ---------- Firestore / Auth REST ----------
const enc = (v) => v === null || v === undefined ? { nullValue: null } : typeof v === 'string' ? { stringValue: v } : typeof v === 'boolean' ? { booleanValue: v }
  : v instanceof Date ? { timestampValue: v.toISOString() } : typeof v === 'number' ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v })
  : Array.isArray(v) ? { arrayValue: { values: v.map(enc) } } : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };

export const projectId = () => {
  const f = path.resolve('.firebaserc');
  if (!fs.existsSync(f)) throw new Error('مش لاقي .firebaserc. شغّل السكريبت من مجلد المشروع.');
  const id = JSON.parse(fs.readFileSync(f, 'utf8')).projects?.default;
  if (!id) throw new Error('.firebaserc مفيهوش مشروع default');
  return id;
};
export async function getToken() {
  if (process.env.GOOGLE_ACCESS_TOKEN) return process.env.GOOGLE_ACCESS_TOKEN;
  const f = process.env.DW_CONFIGSTORE || path.join(os.homedir(), '.config', 'configstore', 'firebase-tools.json');
  if (!fs.existsSync(f)) throw new Error('سجّل دخول Firebase الأول: firebase login --no-localhost');
  const rt = JSON.parse(fs.readFileSync(f, 'utf8')).tokens?.refresh_token;
  if (!rt) throw new Error('مفيش تسجيل دخول Firebase. شغّل: firebase login --no-localhost');
  const r = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: rt, client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com', client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi' }) });
  const j = await r.json();
  if (!j.access_token) throw new Error('تعذر الحصول على صلاحية الدخول: ' + JSON.stringify(j).slice(0, 150));
  return j.access_token;
}
async function call(tok, pid, url, body) {
  const r = await fetch(url, { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json', 'x-goog-user-project': pid }, body: JSON.stringify(body) });
  const t = await r.text(); let j = {}; try { j = JSON.parse(t); } catch { /* not json */ }
  return { ok: r.ok, status: r.status, j, t };
}
export async function ensureUser(tok, pid, a) {
  const base = `${IDT}/v1/projects/${pid}`;
  const c = await call(tok, pid, `${base}/accounts`, { email: a.email, password: PASSWORD, displayName: a.name, emailVerified: true });
  if (c.ok) return c.j.localId;
  if (/EMAIL_EXISTS/.test(c.t)) {
    const l = await call(tok, pid, `${base}/accounts:lookup`, { email: [a.email] });
    const id = l.j.users?.[0]?.localId; if (!id) throw new Error('تعذر العثور على ' + a.email);
    await call(tok, pid, `${base}/accounts:update`, { localId: id, password: PASSWORD });
    return id;
  }
  if (/CONFIGURATION_NOT_FOUND/.test(c.t)) throw new Error('فعّل Authentication (Email/Password) من Firebase Console الأول، وبعدين أعد التشغيل.');
  throw new Error(`تعذر إنشاء ${a.email}: HTTP ${c.status} ${c.t.slice(0, 200)}`);
}
export async function findUser(tok, pid, email) {
  const l = await call(tok, pid, `${IDT}/v1/projects/${pid}/accounts:lookup`, { email: [email] });
  return l.j.users?.[0]?.localId || null;
}
export async function deleteUser(tok, pid, localId) { return call(tok, pid, `${IDT}/v1/projects/${pid}/accounts:delete`, { localId }); }
export async function commit(tok, pid, writes) {
  const root = `projects/${pid}/databases/(default)/documents`;
  for (let i = 0; i < writes.length; i += 100) {
    const chunk = writes.slice(i, i + 100).map((w) => w.del ? { delete: `${root}/${w.path}` }
      : { update: { name: `${root}/${w.path}`, fields: Object.fromEntries(Object.entries(w.data).map(([k, v]) => [k, enc(v)])) } });
    const r = await call(tok, pid, `${FS}/v1/${root}:commit`, { writes: chunk });
    if (!r.ok) throw new Error(`تعذر الكتابة في Firestore: HTTP ${r.status} ${r.t.slice(0, 250)}` + (r.status === 404 ? '\nتأكد إنك عملت قاعدة Firestore (Create database) من Firebase Console.' : ''));
  }
}
