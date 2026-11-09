import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const e = import.meta.env;
const cfg = {
  apiKey: e.VITE_FIREBASE_API_KEY,
  authDomain: e.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: e.VITE_FIREBASE_PROJECT_ID,
  appId: e.VITE_FIREBASE_APP_ID,
  storageBucket: e.VITE_FIREBASE_STORAGE_BUCKET,
};
export const configured = !!(cfg.apiKey && cfg.projectId);
const app = configured ? initializeApp(cfg) : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export const storage = app && cfg.storageBucket ? getStorage(app) : null;

// إنشاء حساب مندوب من غير ما الصيدلية تخرج من حسابها: بنستخدم نسخة تانية من التطبيق بتسجّل دخول المندوب وتكتب ملفه وتخرج
export async function createCourierAccount({ name, email, password }) {
  const app2 = getApps().find((a) => a.name === 'courier-setup') || initializeApp(cfg, 'courier-setup');
  const a2 = getAuth(app2), d2 = getFirestore(app2);
  try {
    const c = await createUserWithEmailAndPassword(a2, email, password);
    await setDoc(doc(d2, 'users', c.user.uid), { name, email, role: 'courier', createdAt: serverTimestamp() });
    return c.user.uid;
  } finally { await signOut(a2).catch(() => {}); }
}
