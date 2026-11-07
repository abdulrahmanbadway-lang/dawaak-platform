import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
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
}[e.code] || 'حصل خطأ: ' + (e.message || e.code));

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(configured);
  const busy = useRef(false);

  const load = async (u) => {
    if (!u) return setProfile(null);
    const s = await getDoc(doc(db, 'users', u.uid));
    setProfile(s.exists() ? { id: u.uid, ...s.data() } : null);
  };
  useEffect(() => {
    if (!configured) return;
    return onAuthStateChanged(auth, async (u) => {
      if (busy.current) return;
      setUser(u);
      try { await load(u); } finally { setLoading(false); }
    });
  }, []);

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password);
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
  const logout = () => signOut(auth);
  return <Ctx.Provider value={{ user, profile, loading, login, register, logout }}>{children}</Ctx.Provider>;
}
