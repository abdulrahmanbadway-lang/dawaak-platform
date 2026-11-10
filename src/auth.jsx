import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, configured } from './firebase.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export const authError = (e) => ({
  'auth/invalid-credential': 'البريد أو كلمة المرور غير صحيحة',
  'auth/wrong-password': 'البريد أو كلمة المرور غير صحيحة',
  'auth/user-not-found': 'البريد أو كلمة المرور غير صحيحة',
  'auth/email-already-in-use': 'البريد ده مستخدم قبل كده',
  'auth/weak-password': 'كلمة المرور ضعيفة (6 أحرف على الأقل)',
  'auth/invalid-email': 'البريد الإلكتروني غير صحيح',
  'auth/network-request-failed': 'مشكلة في الاتصال بالإنترنت',
  'auth/too-many-requests': 'محاولات كتير، استنى شوية وجرّب تاني',
  'auth/missing-email': 'اكتب بريدك الإلكتروني',
}[e.code] || 'حصل خطأ: ' + (e.message || e.code));

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(configured);
  const [issue, setIssue] = useState('');
  const busy = useRef(false);

  const load = async (u) => {
    if (!u) return setProfile(null);
    // لو القراءة فشلت أو مفيش ملف للحساب، نوضّح السبب على الشاشة بدل ما الدخول يفضل صامت
    try {
      const s = await getDoc(doc(db, 'users', u.uid));
      if (s.exists() && s.data().blocked === true) {
        // حساب محظور: نخرّجه ونوضّح السبب (الحظر الفعلي بتفرضه قواعد Firestore على الكتابة والطلبات والروشتات)
        setIssue('حسابك محظور من إدارة الموقع. تواصل مع الدعم لو شايف إن ده بالغلط.'); setProfile(null); signOut(auth).catch(() => {});
      } else if (s.exists()) { setIssue(''); setProfile({ id: u.uid, ...s.data() }); }
      else { setIssue('الحساب سجّل دخول بس مفيش ملف ليه في Firestore (users/' + u.uid + '). أنشئ الملف أو سجّل حساب جديد.'); setProfile(null); }
    } catch (e) {
      console.error('load profile failed', e);
      setIssue('تعذر قراءة ملف الحساب: ' + (e.code || e.message) + (/permission/i.test(e.code || e.message) ? ' (قواعد Firestore بترفض القراءة)' : ''));
      setProfile(null);
    }
  };
  useEffect(() => {
    if (!configured) return;
    return onAuthStateChanged(auth, async (u) => {
      if (busy.current) return;
      setUser(u);
      try { await load(u); } finally { setLoading(false); }
    });
  }, []);

  const login = (email, password) => { setIssue(''); return signInWithEmailAndPassword(auth, email, password); };
  const resetPassword = (email) => sendPasswordResetEmail(auth, email);
  const register = async ({ name, email, password, role, pharmacy }) => {
    busy.current = true;
    try {
      const c = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(c.user, { displayName: name });
      await setDoc(doc(db, 'users', c.user.uid), { name, email, role, createdAt: serverTimestamp() });
      if (role === 'pharmacy')
        await setDoc(doc(db, 'pharmacies', c.user.uid), {
          ...pharmacy, ownerName: name, status: 'active', verified: false, open: true, lat: null, lng: null, createdAt: serverTimestamp(),
        });
      setUser(c.user);
      await load(c.user);
    } finally { busy.current = false; }
  };
  const logout = () => { setIssue(''); return signOut(auth); };
  return <Ctx.Provider value={{ user, profile, loading, issue, login, register, logout, resetPassword }}>{children}</Ctx.Provider>;
}
