// Dawaak demo data + Google REST helpers (بدون أي مكتبات خارجية)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const PASSWORD = 'Dawaak@2027';
const FS = process.env.DW_FS || 'https://firestore.googleapis.com';
const IDT = process.env.DW_IDT || 'https://identitytoolkit.googleapis.com';
const TOKEN_URL = process.env.DW_TOKEN_URL || 'https://oauth2.googleapis.com/token';

// نفس دالة التوحيد المستخدمة في التطبيق (src/lib/text.js)
export const norm = (s = '') => s.toString().trim().toLowerCase()
  .replace(/[\u064B-\u065F]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ');

export const PHARMACIES = [
  { n: 'صيدلية النور', o: 'د. أحمد سمير', g: 'القاهرة', a: 'شارع قصر النيل، وسط البلد', lat: 30.0455, lng: 31.239, h: '9 ص – 12 م', v: true, open: true },
  { n: 'صيدلية الحياة', o: 'د. منى حسن', g: 'القاهرة', a: 'شارع عباس العقاد، مدينة نصر', lat: 30.0626, lng: 31.33, h: '24 ساعة', v: true, open: true },
  { n: 'صيدلية السلام', o: 'د. كريم عادل', g: 'الجيزة', a: 'شارع التحرير، الدقي', lat: 30.0381, lng: 31.2113, h: '8 ص – 1 ص', v: true, open: true },
  { n: 'صيدلية الشفاء', o: 'د. هدى فاروق', g: 'الجيزة', a: 'شارع جامعة الدول العربية، المهندسين', lat: 30.0553, lng: 31.2002, h: '10 ص – 11 م', v: false, open: false },
  { n: 'صيدلية الأمل', o: 'د. طارق مصطفى', g: 'الإسكندرية', a: 'شارع سموحة الرئيسي', lat: 31.2156, lng: 29.9422, h: '9 ص – 2 ص', v: true, open: true },
  { n: 'صيدلية المحبة', o: 'د. نهى إبراهيم', g: 'الدقهلية', a: 'شارع الجلاء، المنصورة', lat: 31.0409, lng: 31.3785, h: '9 ص – 11 م', v: false, open: true },
  { n: 'صيدلية الرحمة', o: 'د. ياسر محمود', g: 'الغربية', a: 'شارع الجيش، طنطا', lat: 30.7865, lng: 31.0004, h: '24 ساعة', v: false, open: true },
  { n: 'صيدلية الصعيد', o: 'د. سلمى عبد الله', g: 'أسيوط', a: 'شارع الجمهورية، أسيوط', lat: 27.1783, lng: 31.1859, h: '9 ص – 12 م', v: true, open: true },
];

const P = (k, name, ing, dose, form, price, rx, desc, warn, kind, c1, c2, label = '', always = false) => ({ k, name, ing, dose, form, price, rx, desc, warn, kind, c1, c2, label, always });
const NOTE = ' اتبع النشرة المرفقة أو إرشاد الصيدلي.';
export const PRODUCTS = [
  P('panadol-extra', 'بنادول إكسترا', 'Paracetamol + Caffeine', '500 ملجم + 65 ملجم', 'قرص', 48, false, 'مسكن للآلام وخافض للحرارة.' + NOTE, 'لا تجمع بينه وبين أي دواء آخر يحتوي على الباراسيتامول.', 'box', '#2F8F6F', '#0F5C5A', 'PANADOL', true),
  P('paracetamol-500', 'باراسيتامول 500', 'Paracetamol', '500 ملجم', 'قرص', 18, false, 'خافض للحرارة ومسكن خفيف.' + NOTE, 'لا تتجاوز الجرعة القصوى اليومية المكتوبة في النشرة.', 'box', '#5aa9e6', '#1f6fb2', 'PARA', true),
  P('brufen-400', 'بروفين 400', 'Ibuprofen', '400 ملجم', 'قرص', 36, false, 'مسكن ومضاد للالتهاب. يُؤخذ بعد الأكل.' + NOTE, 'يُتجنب لمرضى قرحة المعدة أو الحساسية من مضادات الالتهاب إلا بإرشاد الطبيب.', 'box', '#E8741A', '#b3500c', 'BRUFEN'),
  P('vitamin-c', 'فيتامين سي 1000', 'Ascorbic acid', '1000 ملجم', 'قرص', 120, false, 'مكمل غذائي فوار (20 قرص).' + NOTE, 'لا يغني عن الغذاء المتوازن. استشر الصيدلي لو بتتناول أدوية أخرى.', 'bottle', '#FFB347', '#E8741A', '', true),
  P('strepsils', 'ستربسيلز', 'Amylmetacresol + Dichlorobenzyl alcohol', 'أقراص مص', 'أخرى', 55, false, 'لتخفيف ألم وتهيج الحلق.' + NOTE, 'راجع الطبيب لو استمر ألم الحلق أكثر من أيام قليلة.', 'box', '#F29BB0', '#D6577A', 'STREP'),
  P('voltaren-emulgel', 'فولتارين إميلجيل', 'Diclofenac diethylamine', '1%', 'كريم / مرهم', 95, false, 'جل موضعي لتخفيف آلام العضلات والمفاصل.' + NOTE, 'للاستخدام الخارجي فقط، وبعيداً عن الجروح والعين.', 'jar', '#7FB7E0', '#3F86B8', 'EMULGEL'),
  P('antinal', 'أنتينال', 'Nifuroxazide', '200 ملجم', 'كبسولة', 42, false, 'يُستخدم في حالات الإسهال العارض.' + NOTE, 'مع الإسهال الشديد أو المستمر راجع الطبيب، وعوّض السوائل.', 'box', '#7A6FD0', '#4B3FA8', 'ANTINAL'),
  P('claritine', 'كلاريتين', 'Loratadine', '10 ملجم', 'قرص', 60, false, 'لتخفيف أعراض الحساسية.' + NOTE, 'استشر الصيدلي أو الطبيب في الحمل والرضاعة.', 'box', '#35b6a1', '#17806f', 'CLARITINE'),
  P('gaviscon', 'جافيسكون', 'Sodium alginate + Sodium bicarbonate + Calcium carbonate', '150 مل', 'شراب', 85, false, 'لتخفيف الحموضة وارتجاع المريء.' + NOTE, 'راجع الطبيب لو استمرت الأعراض.', 'bottle', '#8bd3a8', '#2c9964'),
  P('otrivin', 'أوتريفين', 'Xylometazoline', '0.1%', 'بخاخ', 38, false, 'لتخفيف احتقان الأنف.' + NOTE, 'لا يُستخدم لفترات طويلة إلا بإرشاد الطبيب.', 'bottle', '#6fb7f2', '#2b7fc9'),
  P('betadine', 'بيتادين', 'Povidone-iodine', '10%', 'أخرى', 30, false, 'مطهر موضعي للجروح السطحية.' + NOTE, 'للاستخدام الخارجي فقط. تجنبه لو عندك حساسية من اليود.', 'bottle', '#c9803a', '#8a4f14'),
  P('thermometer', 'ميزان حرارة رقمي', '', '', 'أخرى', 70, false, 'ميزان حرارة رقمي سريع القراءة.', '', 'box', '#cfd8dc', '#78909c', 'TEMP'),
  P('bp-monitor', 'جهاز قياس ضغط رقمي', '', '', 'أخرى', 850, false, 'جهاز رقمي لقياس ضغط الدم المنزلي.', 'القياس المنزلي لا يغني عن متابعة الطبيب.', 'box', '#4B5B63', '#222E34', '120/80'),
  P('glucose-strips', 'شرائط قياس السكر', '', '50 شريط', 'أخرى', 230, false, 'شرائط لقياس السكر بالجهاز المناسب لها.', 'تأكد من تاريخ الصلاحية وتوافقها مع جهازك.', 'box', '#7A6FD0', '#4B3FA8', 'GLUCO'),
  P('augmentin-1g', 'أوجمنتين 1 جم', 'Amoxicillin + Clavulanic acid', '1 جم', 'قرص', 135, true, 'مضاد حيوي يُصرف بروشتة طبية فقط.', 'يُستخدم تحت إشراف الطبيب وبالجرعة والمدة المحددة له.', 'box', '#2c8a52', '#14532d', 'AUGMENTIN'),
  P('glucophage-500', 'جلوكوفاج 500', 'Metformin', '500 ملجم', 'قرص', 45, true, 'دواء لمرضى السكر يُصرف بروشتة طبية.', 'لا تغيّر الجرعة بدون الطبيب.', 'box', '#e57373', '#b23a3a', 'GLUCO-F'),
  P('concor-5', 'كونكور 5', 'Bisoprolol', '5 ملجم', 'قرص', 62, true, 'دواء للقلب والضغط يُصرف بروشتة طبية.', 'لا يُوقف فجأة بدون الطبيب.', 'box', '#5C6BC0', '#303F9F', 'CONCOR'),
  P('ventolin', 'فنتولين', 'Salbutamol', '100 مكج', 'بخاخ', 48, true, 'بخاخ لتوسيع الشعب الهوائية يُصرف بروشتة طبية.', 'في ضيق التنفس الشديد اطلب الإسعاف 123.', 'bottle', '#4FC3F7', '#0288D1'),
];

export const ACCOUNTS = [
  ...PHARMACIES.map((p, i) => ({ key: 'ph' + (i + 1), email: `ph${i + 1}@dawaak.test`, name: p.o, role: 'pharmacy' })),
  { key: 'patient', email: 'patient@dawaak.test', name: 'مريض تجريبي', role: 'patient' },
];

function rng(seed) { // mulberry32
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function pack(p) { // صورة SVG بسيطة للمنتج
  const a = `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.c1}"/><stop offset="1" stop-color="${p.c2}"/></linearGradient></defs>`;
  let b;
  if (p.kind === 'bottle') b = `<rect x="85" y="46" width="30" height="18" rx="4" fill="${p.c2}"/><rect x="70" y="62" width="60" height="104" rx="12" fill="url(#g)"/><rect x="70" y="100" width="60" height="30" fill="#fff" opacity=".92"/>`;
  else if (p.kind === 'jar') b = `<rect x="58" y="70" width="84" height="78" rx="12" fill="url(#g)"/><rect x="64" y="56" width="72" height="18" rx="6" fill="#fff" opacity=".95"/><rect x="58" y="96" width="84" height="26" fill="#fff" opacity=".92"/>`;
  else b = `<rect x="58" y="44" width="84" height="122" rx="10" fill="url(#g)"/><rect x="58" y="96" width="84" height="32" fill="#fff" opacity=".92"/><text x="100" y="76" font-size="11" font-weight="bold" font-family="Arial" fill="#fff" text-anchor="middle">${p.label}</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#E6F5F0"/>${a}<ellipse cx="100" cy="172" rx="48" ry="7" fill="#000" opacity=".12"/>${b}</svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

// uid(key) -> uid الحقيقي للحساب. بيرجع قائمة مستندات {path, data}
// حالات ثابتة للتجربة: بنادول نفد في الدقي (3) والأسكندرية (8=أسيوط)، وكمية قليلة في مدينة نصر (2)
const FORCE = { 'panadol-extra': { 2: 2, 3: 0, 8: 0 }, 'vitamin-c': { 1: 0 } };
export function buildDocs(uid) {
  const docs = [], now = Date.now(), prods = {};
  ACCOUNTS.forEach((a) => docs.push({ path: `users/${uid(a.key)}`, data: { name: a.name, email: a.email, role: a.role, createdAt: new Date(now), seed: true } }));
  PHARMACIES.forEach((p, i) => {
    const id = uid('ph' + (i + 1));
    docs.push({ path: `pharmacies/${id}`, data: { name: p.n, ownerName: p.o, license: `EG-PH-${1001 + i}`, phone: `01000000${String(10 + i).padStart(3, '0')}`, governorate: p.g, address: p.a, hours: p.h, lat: p.lat, lng: p.lng, open: p.open, status: 'active', verified: p.v, createdAt: new Date(now), seed: true } });
    const r = rng(101 + i * 7);
    PRODUCTS.forEach((pr) => {
      if (!pr.always && r() > 0.78) return;
      const price = Math.round(pr.price * (0.92 + r() * 0.2)), x = r();
      let stock = x < 0.12 ? 0 : x < 0.3 ? 1 + Math.floor(r() * 4) : 5 + Math.floor(r() * 56);
      if (FORCE[pr.k]?.[i + 1] !== undefined) stock = FORCE[pr.k][i + 1]; // حالات اختبار ثابتة
      const d = { pharmacyId: id, name: pr.name, nameLower: norm(pr.name), ingredient: pr.ing, ingredientLower: norm(pr.ing), dose: pr.dose, form: pr.form, price, stock, rx: pr.rx, description: pr.desc, warnings: pr.warn, imageUrl: pack(pr), createdAt: new Date(now), updatedAt: new Date(now), seed: true };
      docs.push({ path: `products/seed-${i + 1}-${pr.k}`, data: d });
      if (i === 0) prods[pr.k] = { id: `seed-1-${pr.k}`, ...d };
    });
  });
  const line = (k, qty) => ({ productId: prods[k].id, name: prods[k].name, dose: prods[k].dose || '', price: prods[k].price, qty });
  const mk = (n, status, ago, items) => {
    const total = items.reduce((s, x) => s + x.price * x.qty, 0), t = new Date(now - ago);
    docs.push({ path: `orders/seed-order-${n}`, data: { patientId: uid('patient'), patientName: 'مريض تجريبي', phone: '01234567890', address: '٥ شارع النيل، الدقي، الجيزة', note: '', pharmacyId: uid('ph1'), pharmacyName: PHARMACIES[0].n, items, total, status, createdAt: t, updatedAt: t, seed: true } });
  };
  mk(1, 'done', 3 * 864e5, [line('panadol-extra', 2), line('vitamin-c', 1)]);
  mk(2, 'preparing', 36e5, [line('brufen-400', 1), line('betadine', 1)]);
  mk(3, 'new', 3e5, [line('claritine', 1)]);
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
  for (let i = 0; i < writes.length; i += 300) {
    const chunk = writes.slice(i, i + 300).map((w) => w.del ? { delete: `${root}/${w.path}` }
      : { update: { name: `${root}/${w.path}`, fields: Object.fromEntries(Object.entries(w.data).map(([k, v]) => [k, enc(v)])) } });
    const r = await call(tok, pid, `${FS}/v1/${root}:commit`, { writes: chunk });
    if (!r.ok) throw new Error(`تعذر الكتابة في Firestore: HTTP ${r.status} ${r.t.slice(0, 250)}` + (r.status === 404 ? '\nتأكد إنك عملت قاعدة Firestore (Create database) من Firebase Console.' : ''));
  }
}
