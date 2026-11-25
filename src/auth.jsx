import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { deleteField, doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, configured } from './firebase.js';
import { trs } from './lib/i18n.js';
import { toast } from './ui.jsx';
import { PHONE_RE, kindOf, normPhone } from './lib/phone.js';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export const authError = (e) => ({
  'auth/invalid-credential': trs("بيانات الدخول أو كلمة المرور غير صحيحة"),
  'auth/wrong-password': trs("بيانات الدخول أو كلمة المرور غير صحيحة"),
  'auth/user-not-found': trs("بيانات الدخول أو كلمة المرور غير صحيحة"),
  'auth/email-already-in-use': trs("البريد ده مستخدم قبل كده"),
  'auth/weak-password': trs("كلمة المرور ضعيفة (6 أحرف على الأقل)"),
  'auth/invalid-email': trs("البريد الإلكتروني غير صحيح"),
  'auth/network-request-failed': trs("مشكلة في الاتصال بالإنترنت"),
  'auth/too-many-requests': trs("محاولات كتير، استنى شوية وجرّب تاني"),
  'auth/missing-email': trs("اكتب بريدك الإلكتروني"),
  'auth/requires-recent-login': trs("سجّل دخول تاني وجرّب"),
  'dw/phone-taken': trs("الرقم ده مستخدم في حساب تاني"),
  'dw/bad-phone': trs("اكتب رقم موبايل مصري صحيح (مثال 01012345678)"),
}[e.code] || trs("حصل خطأ: ") + (e.message || e.code));

const fail = (code) => Object.assign(new Error(code), { code });
// الرقم ← إيميل الحساب (من فهرس الدخول). لو الرقم مش موجود بنرجّع نفس رسالة "بيانات غلط" علشان منكشفش مين مسجّل
export async function emailFor(id) {
  const v = String(id).trim();
  if (kindOf(v) === 'email') return v;
  const ph = normPhone(v);
  if (!PHONE_RE.test(ph)) throw fail('auth/invalid-credential');
  const s = await getDoc(doc(db, 'loginIds', ph));
  if (!s.exists() || !s.data().email) throw fail('auth/invalid-credential');
  return s.data().email;
}
export async function phoneFree(ph, uid) {
  const s = await getDoc(doc(db, 'loginIds', ph));
  return !s.exists() || s.data().uid === uid;
}
// بنربط الرقم بالحساب: users.phone أولًا (القاعدة بتقارنه)، وبعدين الفهرس. لو الرقم اتحجز في نفس اللحظة بنرجّع الحقل زي ما كان.
export async function claimPhone(user, ph, prev) {
  await updateDoc(doc(db, 'users', user.uid), { phone: ph });
  try { await setDoc(doc(db, 'loginIds', ph), { uid: user.uid, email: user.email, updatedAt: serverTimestamp() }); }
  catch (e) {
    try { await updateDoc(doc(db, 'users', user.uid), prev ? { phone: prev } : { phone: deleteField() }); } catch { /* ignore */ }
    throw e.code === 'permission-denied' ? fail('dw/phone-taken') : e;
  }
}
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
        setIssue(trs("حسابك محظور من إدارة الموقع. تواصل مع الدعم لو شايف إن ده بالغلط.")); setProfile(null); signOut(auth).catch(() => {});
      } else if (s.exists()) {
        setIssue(''); const d = s.data(); setProfile({ id: u.uid, ...d });
        // مزامنة هادئة: لو الإيميل اتغيّر (بعد تأكيد الرابط) نحدّث ملف الحساب وفهرس الرقم
        if (u.email && d.email !== u.email) updateDoc(doc(db, 'users', u.uid), { email: u.email }).then(() => setProfile((p) => p && { ...p, email: u.email })).catch(() => {});
        if (d.phone && u.email) getDoc(doc(db, 'loginIds', d.phone)).then((x) => {
          if (x.exists() && x.data().uid === u.uid && x.data().email !== u.email) setDoc(doc(db, 'loginIds', d.phone), { uid: u.uid, email: u.email, updatedAt: serverTimestamp() }).catch(() => {});
        }).catch(() => {});
      }
      else { setIssue(trs("الحساب سجّل دخول بس مفيش ملف ليه في Firestore (users/") + u.uid + trs("). أنشئ الملف أو سجّل حساب جديد.")); setProfile(null); }
    } catch (e) {
      console.error('load profile failed', e);
      setIssue(trs("تعذر قراءة ملف الحساب: ") + (e.code || e.message) + (/permission/i.test(e.code || e.message) ? trs(" (قواعد Firestore بترفض القراءة)") : ''));
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

  const login = async (id, password) => { setIssue(''); return signInWithEmailAndPassword(auth, await emailFor(id), password); };
  const resetPassword = async (id) => sendPasswordResetEmail(auth, await emailFor(id));
  const reloadProfile = () => load(auth.currentUser);
  const register = async ({ name, email, phone, password, role, pharmacy, docs }) => {
    const ph = normPhone(phone);
    if (!PHONE_RE.test(ph)) throw fail('dw/bad-phone');
    busy.current = true;
    try {
      if (!(await phoneFree(ph, null))) throw fail('dw/phone-taken'); // قبل ما نعمل الحساب علشان منسيبش حساب ناقص
      const c = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(c.user, { displayName: name });
      await setDoc(doc(db, 'users', c.user.uid), { name, email, phone: ph, role, createdAt: serverTimestamp() });
      // فهرس الدخول بالرقم. لو فشل (حجز متزامن) الحساب بيفضل شغّال بالإيميل، والرقم يتضاف من "حسابي"
      try { await setDoc(doc(db, 'loginIds', ph), { uid: c.user.uid, email: c.user.email, updatedAt: serverTimestamp() }); }
      catch { await updateDoc(doc(db, 'users', c.user.uid), { phone: deleteField() }).catch(() => {}); toast(trs("اتعمل الحساب لكن الرقم ده اتحجز قبل كده. ضيف رقمك من حسابي.")); }
      if (role === 'pharmacy')
        await setDoc(doc(db, 'pharmacies', c.user.uid), {
          ...pharmacy, ownerName: name, status: 'active', verified: false, open: true, lat: pharmacy.lat ?? null, lng: pharmacy.lng ?? null, createdAt: serverTimestamp(),
        });
      // المستندات الرسمية في مجموعة منفصلة (الصيدلية صاحبتها والأدمن بس يقروها)
      if (role === 'pharmacy' && docs)
        await setDoc(doc(db, 'pharmacyDocs', c.user.uid), { commercial: docs.commercial, tax: docs.tax, license: docs.license, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      setUser(c.user);
      await load(c.user);
    } finally { busy.current = false; }
  };
  const logout = () => { setIssue(''); return signOut(auth); };
  return <Ctx.Provider value={{ user, profile, loading, issue, login, register, logout, resetPassword, reloadProfile }}>{children}</Ctx.Provider>;
}
