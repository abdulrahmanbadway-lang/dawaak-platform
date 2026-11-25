import { useState } from 'react';
import { EmailAuthProvider, reauthenticateWithCredential, verifyBeforeUpdateEmail } from 'firebase/auth';
import { deleteDoc, doc } from 'firebase/firestore';
import { auth, db } from '../firebase.js';
import { authError, claimPhone, phoneFree, useAuth } from '../auth.jsx';
import { Field, toast } from '../ui.jsx';
import { trs } from '../lib/i18n.js';
import { PHONE_RE, normPhone } from '../lib/phone.js';

// حسابي: تغيير الإيميل (برابط تأكيد على الإيميل الجديد) وتغيير/إضافة رقم الموبايل. الاتنين بيطلبوا كلمة السر الحالية.
export default function Account() {
  const { user, profile, reloadProfile } = useAuth();
  const [em, setEm] = useState({ v: '', pw: '' }), [ph, setPh] = useState({ v: '', pw: '' });
  const [err, setErr] = useState({}), [busy, setBusy] = useState(''), [sent, setSent] = useState('');
  if (!user || !profile) return <div className="card narrow"><h2>{trs("حسابي")}</h2><p className="mu">{trs("سجّل دخولك الأول.")}</p><a className="btn full" href="#/login">{trs("دخول")}</a></div>;
  const reauth = (pw) => reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, pw));
  const E = (k, m) => setErr((x) => ({ ...x, [k]: m }));

  const changeEmail = async (e) => {
    e.preventDefault(); E('em', ''); setSent('');
    const v = em.v.trim();
    if (!/^\S+@\S+\.\S+$/.test(v)) return E('em', trs("اكتب بريد إلكتروني صحيح"));
    if (v.toLowerCase() === (user.email || '').toLowerCase()) return E('em', trs("ده هو بريدك الحالي"));
    if (!em.pw) return E('em', trs("اكتب كلمة السر الحالية"));
    setBusy('em');
    try { await reauth(em.pw); await verifyBeforeUpdateEmail(user, v); setSent(v); setEm({ v: '', pw: '' }); }
    catch (x) { E('em', x.code === 'auth/operation-not-allowed' ? trs("تغيير البريد مش متاح حاليًا، تواصل مع الدعم") : authError(x)); }
    setBusy('');
  };
  const changePhone = async (e) => {
    e.preventDefault(); E('ph', '');
    const n = normPhone(ph.v);
    if (!PHONE_RE.test(n)) return E('ph', trs("اكتب رقم موبايل مصري صحيح (مثال 01012345678)"));
    if (n === profile.phone) return E('ph', trs("ده هو رقمك الحالي"));
    if (!ph.pw) return E('ph', trs("اكتب كلمة السر الحالية"));
    setBusy('ph');
    try {
      await reauth(ph.pw);
      if (!(await phoneFree(n, user.uid))) throw Object.assign(new Error('x'), { code: 'dw/phone-taken' });
      const old = profile.phone;
      await claimPhone(user, n, old);
      if (old) await deleteDoc(doc(db, 'loginIds', old)).catch(() => {}); // الرقم القديم يتحرر
      await reloadProfile(); setPh({ v: '', pw: '' }); toast(trs("اتحدّث رقمك ✓"));
    } catch (x) { E('ph', authError(x)); }
    setBusy('');
  };
  return (
    <div className="narrow acct">
      <h2>{trs("حسابي")}</h2>
      <div className="card"><b>{profile.name}</b><p className="mu sm2" dir="ltr" style={{ textAlign: 'start' }}>{user.email}{profile.phone ? ' · ' + profile.phone : ''}</p></div>

      <form className="card" onSubmit={changeEmail} noValidate>
        <h3>{trs("تغيير البريد الإلكتروني")}</h3>
        <p className="mu sm2">{trs("هنبعت رابط تأكيد على البريد الجديد. البريد مش هيتغيّر إلا بعد ما تضغط الرابط.")}</p>
        <Field label={trs("البريد الجديد")} name="newemail" type="email" v={em.v} on={(v) => setEm((x) => ({ ...x, v }))} autoComplete="email" dir="ltr" />
        <Field label={trs("كلمة السر الحالية")} name="empw" type="password" v={em.pw} on={(v) => setEm((x) => ({ ...x, pw: v }))} autoComplete="current-password" dir="ltr" />
        {err.em && <p className="err" role="alert">{err.em}</p>}
        {sent && <p className="ok" role="status">{trs("بعتنا رابط التأكيد على")} <bdi dir="ltr">{sent}</bdi>. {trs("افتحه علشان يتفعّل البريد الجديد، وإلى ساعتها كمّل بالبريد القديم أو برقمك.")}</p>}
        <button className="btn full" disabled={busy === 'em'}>{busy === 'em' ? '…' : trs("إرسال رابط التأكيد")}</button>
      </form>

      <form className="card" onSubmit={changePhone} noValidate>
        <h3>{profile.phone ? trs("تغيير رقم الموبايل") : trs("إضافة رقم موبايل")}</h3>
        <p className="mu sm2">{trs("تقدر تسجّل دخول برقمك أو ببريدك بنفس كلمة السر. الرقم مش بيتأكد بكود SMS، فاكتب رقمك الصحيح.")}</p>
        <Field label={trs("رقم الموبايل")} name="newphone" type="tel" v={ph.v} on={(v) => setPh((x) => ({ ...x, v }))} autoComplete="tel" dir="ltr" inputMode="tel" />
        <Field label={trs("كلمة السر الحالية")} name="phpw" type="password" v={ph.pw} on={(v) => setPh((x) => ({ ...x, pw: v }))} autoComplete="current-password" dir="ltr" />
        {err.ph && <p className="err" role="alert">{err.ph}</p>}
        <button className="btn full" disabled={busy === 'ph'}>{busy === 'ph' ? '…' : trs("حفظ الرقم")}</button>
      </form>
    </div>);
}
