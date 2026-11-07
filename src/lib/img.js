import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase.js';

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
export async function uploadImage(file, uid) {
  const blob = await compress(file);
  if (import.meta.env.VITE_USE_STORAGE === '1' && storage) {
    const r = ref(storage, `products/${uid}/${Date.now()}.jpg`);
    await uploadBytes(r, blob, { contentType: 'image/jpeg' });
    return getDownloadURL(r);
  }
  return new Promise((ok) => { const fr = new FileReader(); fr.onload = () => ok(fr.result); fr.readAsDataURL(blob); });
}
