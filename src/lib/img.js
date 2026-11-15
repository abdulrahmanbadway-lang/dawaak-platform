import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase.js';
import { trs } from './i18n.js';

// ضغط الصورة قبل الرفع (أقصى بُعد 420px) عشان تبقى خفيفة
export async function compress(file, max = 420, q = 0.72) {
  const url = URL.createObjectURL(file);
  const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
  const s = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(url);
  return new Promise((ok) => c.toBlob(ok, 'image/jpeg', q));
}
// صورة المنتج بدون Storage: بتتضغط تدريجياً لحد ما تبقى أقل من 90 ألف حرف (قواعد Firestore بترفض أكتر من 200 ألف).
// الحد الأقل ده بيخلي الكتالوج الكبير خفيف في التحميل (كل مستند منتج بيشيل صورته جواه).
export const PRODUCT_IMG_MAX_CHARS = 90000;
export async function productImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error(trs("تعذر قراءة الصورة"))); i.src = url; });
    for (const [max, q] of [[420, 0.74], [360, 0.68], [320, 0.62], [280, 0.56], [240, 0.5], [200, 0.45]]) {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      const x = c.getContext('2d');
      x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
      const d = c.toDataURL('image/jpeg', q);
      if (d.length <= PRODUCT_IMG_MAX_CHARS) return d;
    }
    throw new Error(trs("الصورة كبيرة جداً. صوّر العبوة من مسافة أقرب."));
  } finally { URL.revokeObjectURL(url); }
}
export async function uploadImage(file, uid) {
  if (import.meta.env.VITE_USE_STORAGE === '1' && storage) {
    const blob = await compress(file);
    const r = ref(storage, `products/${uid}/${Date.now()}.jpg`);
    await uploadBytes(r, blob, { contentType: 'image/jpeg' });
    return getDownloadURL(r);
  }
  return productImage(file);
}

// صورة الروشتة: بتتضغط تدريجياً لحد ما تبقى مناسبة للتخزين داخل مستند Firestore (حد أقصى 300 ألف حرف للصورة)
export const RX_MAX_CHARS = 300000;
export async function rxImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error(trs("تعذر قراءة الصورة"))); i.src = url; });
    for (const [max, q] of [[1280, 0.72], [1100, 0.65], [960, 0.58], [820, 0.5], [700, 0.42]]) {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      const x = c.getContext('2d');
      x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
      const d = c.toDataURL('image/jpeg', q);
      if (d.length <= RX_MAX_CHARS) return d;
    }
    throw new Error(trs("الصورة كبيرة جداً. صوّر الروشتة من مسافة أقرب أو بإضاءة أحسن."));
  } finally { URL.revokeObjectURL(url); }
}

// صورة إعلان: مقصوصة بنسبة 1000×375 ومضغوطة لأقل من 150 ألف حرف (القواعد ترفض أكتر من 200 ألف)
export async function bannerImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('تعذر قراءة الصورة')); i.src = url; });
    for (const [w, q] of [[1000, 0.8], [900, 0.7], [760, 0.62], [640, 0.55], [520, 0.48]]) {
      const h = Math.round(w * 0.375), c = document.createElement('canvas');
      c.width = w; c.height = h;
      const x = c.getContext('2d'), s = Math.max(w / img.width, h / img.height), dw = img.width * s, dh = img.height * s;
      x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
      const d = c.toDataURL('image/jpeg', q);
      if (d.length <= 150000) return d;
    }
    throw new Error('الصورة معقّدة وكبيرة. جرّب صورة أبسط أو بحجم أصغر.');
  } finally { URL.revokeObjectURL(url); }
}

// صورة مستند رسمي (سجل تجاري / بطاقة ضريبية / رخصة): أوضح من صورة المنتج، ومضغوطة لأقل من 240 ألف حرف
// (3 مستندات في مستند Firestore واحد لازم تفضل تحت الحد الأقصى 1 ميجا)
export const DOC_MAX_CHARS = 240000;
export async function docImage(file) {
  if (!file || !/^image\//.test(file.type)) throw new Error(trs("اختار صورة (JPG أو PNG)"));
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error(trs("تعذر قراءة الصورة"))); i.src = url; });
    for (const [max, q] of [[1600, 0.74], [1400, 0.66], [1200, 0.58], [1000, 0.5], [900, 0.42]]) {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      const x = c.getContext('2d');
      x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
      const d = c.toDataURL('image/jpeg', q);
      if (d.length <= DOC_MAX_CHARS) return d;
    }
    throw new Error(trs("الصورة كبيرة جداً. صوّر المستند من مسافة أقرب وبإضاءة كويسة."));
  } finally { URL.revokeObjectURL(url); }
}


// ───────── صورة بديلة احترافية لكل قسم (بدون أي تحميل: SVG داخل الرابط نفسه) ─────────
const PH = [
  // [كلمة في اسم القسم, لون1, لون2, الرسمة]
  ['فيتامين', '#F59E0B', '#EA7A0A', 'jar'], ['شعر', '#8B5CF6', '#6D3FD6', 'wave'], ['بشرة', '#EC6FA3', '#D6407E', 'drop'],
  ['طفل', '#14B8A6', '#0E8F82', 'face'], ['جنس', '#E5484D', '#B91C3C', 'heart'], ['يومية', '#10B981', '#059669', 'spark'],
  ['مستلزم', '#64748B', '#475569', 'cross'], ['دو', '#2F80C9', '#1B5E9E', 'pill'],
];
const ART = {
  pill: '<g transform="rotate(-35 80 80)"><rect x="42" y="58" width="76" height="44" rx="22" fill="#fff" fill-opacity=".95"/><path d="M80 58h18a22 22 0 0 1 0 44H80z" fill="#fff" fill-opacity=".55"/><rect x="42" y="58" width="76" height="44" rx="22" fill="none" stroke="#fff" stroke-width="2"/></g>',
  jar: '<rect x="52" y="44" width="56" height="14" rx="5" fill="#fff"/><rect x="46" y="58" width="68" height="62" rx="14" fill="#fff" fill-opacity=".95"/><rect x="58" y="76" width="44" height="26" rx="6" fill="#000" fill-opacity=".12"/><circle cx="80" cy="89" r="6" fill="#fff"/>',
  wave: '<g fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round"><path d="M46 62c12-14 20 14 34 0s22 14 34 0"/><path d="M46 84c12-14 20 14 34 0s22 14 34 0" stroke-opacity=".85"/><path d="M46 106c12-14 20 14 34 0s22 14 34 0" stroke-opacity=".65"/></g>',
  drop: '<path d="M80 38c18 26 32 42 32 60a32 32 0 0 1-64 0c0-18 14-34 32-60z" fill="#fff" fill-opacity=".95"/><path d="M66 100a16 16 0 0 0 14 14" fill="none" stroke="#000" stroke-opacity=".18" stroke-width="6" stroke-linecap="round"/>',
  face: '<circle cx="80" cy="80" r="40" fill="#fff" fill-opacity=".95"/><circle cx="66" cy="74" r="5" fill="#000" fill-opacity=".35"/><circle cx="94" cy="74" r="5" fill="#000" fill-opacity=".35"/><path d="M64 92c8 12 24 12 32 0" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="5" stroke-linecap="round"/>',
  heart: '<path d="M80 118S44 96 44 68a20 20 0 0 1 36-12 20 20 0 0 1 36 12c0 28-36 50-36 50z" fill="#fff" fill-opacity=".95"/>',
  spark: '<path d="M80 36l10 28 28 10-28 10-10 28-10-28-28-10 28-10z" fill="#fff" fill-opacity=".95"/><circle cx="116" cy="46" r="6" fill="#fff" fill-opacity=".7"/><circle cx="46" cy="112" r="5" fill="#fff" fill-opacity=".6"/>',
  cross: '<rect x="64" y="40" width="32" height="80" rx="9" fill="#fff" fill-opacity=".95"/><rect x="40" y="64" width="80" height="32" rx="9" fill="#fff" fill-opacity=".95"/>',
};
const phCache = new Map();
const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0; return Math.abs(h); };
// بيرجّع رابط data: لصورة SVG ملوّنة حسب القسم، وبتتغيّر زخرفتها بسيط حسب اسم المنتج (فمنتجين في نفس القسم مش شكلهم واحد بالظبط)
export function categoryPlaceholder(category = '', name = '') {
  const key = category + '|' + (hash(name) % 6);
  if (phCache.has(key)) return phCache.get(key);
  const [, c1, c2, art] = PH.find(([w]) => category.includes(w)) || [0, '#2F80C9', '#1B5E9E', 'pill'];
  const h = hash(name), ang = [135, 160, 200, 225, 110, 250][h % 6];
  const r1 = 24 + (h % 5) * 6, r2 = 14 + ((h >> 3) % 4) * 5;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><defs><linearGradient id="g" gradientTransform="rotate(${ang} .5 .5)"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="160" height="160" fill="url(#g)"/><circle cx="${20 + (h % 40)}" cy="${18 + ((h >> 2) % 30)}" r="${r1}" fill="#fff" fill-opacity=".09"/><circle cx="${120 + (h % 30)}" cy="${130 - ((h >> 4) % 20)}" r="${r2 + 18}" fill="#000" fill-opacity=".07"/>${ART[art]}</svg>`;
  const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  phCache.set(key, url);
  return url;
}
export const isRealImage = (u) => typeof u === 'string' && /^(data:image\/(jpeg|png|webp);base64,|https?:\/\/)/.test(u);
// صورة المنتج للعرض: الحقيقية لو موجودة، وإلا صورة القسم البديلة
export const productImageUrl = (p) => (p && isRealImage(p.imageUrl) ? p.imageUrl : categoryPlaceholder(p?.category || '', p?.name || ''));
