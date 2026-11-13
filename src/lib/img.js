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
// صورة المنتج بدون Storage: بتتضغط تدريجياً لحد ما تبقى أقل من 150 ألف حرف (قواعد Firestore بترفض أكتر من 200 ألف)
export const PRODUCT_IMG_MAX_CHARS = 150000;
export async function productImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error(trs("تعذر قراءة الصورة"))); i.src = url; });
    for (const [max, q] of [[560, 0.78], [480, 0.7], [400, 0.62], [320, 0.52], [260, 0.45]]) {
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
