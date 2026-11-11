import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, createCourierAccount } from '../firebase.js';
import { authError } from '../auth.jsx';
import { Badge, Field, toast } from '../ui.jsx';
import { trs } from '../lib/i18n.js';

// مناديب الصيدلية (لحظي)
export function useCouriers(uid) {
  const [rows, setRows] = useState(null);
  useEffect(() => onSnapshot(query(collection(db, 'couriers'), where('pharmacyId', '==', uid)),
    (s) => setRows(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name, 'ar'))),
    () => setRows([])), [uid]);
  return rows;
}

export default function Couriers({ uid, rows }) {
  const [f, setF] = useState({ name: '', phone: '', email: '', password: '' }), [busy, setBusy] = useState(false), [made, setMade] = useState(null);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
  const add = async (e) => {
    e.preventDefault();
    const name = f.name.trim(), phone = f.phone.trim(), email = f.email.trim();
    if (name.length < 2) return toast(trs("اكتب اسم المندوب"));
    if (phone.length < 8) return toast(trs("اكتب رقم موبايل المندوب"));
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast(trs("اكتب بريد إلكتروني صحيح"));
    if (f.password.length < 6) return toast(trs("كلمة المرور 6 أحرف على الأقل"));
    setBusy(true);
    try {
      const cuid = await createCourierAccount({ name, email, password: f.password });
      await setDoc(doc(db, 'couriers', cuid), { pharmacyId: uid, name, phone, active: true, createdAt: serverTimestamp() });
      setMade({ email, password: f.password, name });
      setF({ name: '', phone: '', email: '', password: '' });
      toast(trs("تم إضافة المندوب ✓"));
    } catch (x) { toast(x.code ? authError(x) : trs("تعذر إضافة المندوب: ") + x.message); }
    setBusy(false);
  };
  const toggle = async (c) => { try { await updateDoc(doc(db, 'couriers', c.id), { active: !c.active }); } catch (x) { toast(trs("تعذر التحديث: ") + x.message); } };
  return (
    <div>
      {made && <div className="card"><h3>{trs("حساب")}{" "}{made.name} {trs("جاهز ✓")}</h3>
        <p className="mu sm2">{trs("ادّي المندوب البيانات دي. هيدخل بيها من الرابط ده على موبايله:")}</p>
        <pre dir="ltr">{location.origin + '/#/courier'}{'\n'}{made.email}{'\n'}{made.password}</pre>
        <button className="btn o sm" onClick={() => setMade(null)}>{trs("تمام، اخفي")}</button></div>}
      <form className="card narrow" onSubmit={add}>
        <h3>{trs("إضافة مندوب توصيل")}</h3>
        <Field label={trs("اسم المندوب")} name="cname" v={f.name} on={set('name')} />
        <Field label={trs("رقم الموبايل")} name="cphone" type="tel" v={f.phone} on={set('phone')} dir="ltr" maxLength={20} />
        <Field label={trs("البريد الإلكتروني (للدخول)")} name="cemail" type="email" v={f.email} on={set('email')} dir="ltr" autoComplete="off" />
        <Field label={trs("كلمة المرور")} name="cpass" type="text" v={f.password} on={set('password')} dir="ltr" autoComplete="off" hint={trs("6 أحرف على الأقل. المندوب يقدر يشوف طلباته بس.")} />
        <button className="btn g full" disabled={busy}>{busy ? '…' : trs("إضافة المندوب")}</button>
      </form>
      {rows && !rows.length && <div className="card center"><p className="mu">{trs("لسه مضفتش مناديب. من غير مندوب الطلب بيتوصّل من غير تتبع مباشر.")}</p></div>}
      {rows?.map((c) => (
        <div className="card row between wrap" key={c.id}>
          <div><h3>{c.name} <Badge c={c.active ? 'ok' : 'rd'}>{c.active ? trs("شغّال") : trs("موقوف")}</Badge></h3><p className="mu sm2" dir="ltr" style={{ textAlign: 'right' }}>{c.phone}</p></div>
          <button className="btn o sm" onClick={() => toggle(c)}>{c.active ? trs("إيقاف") : trs("تفعيل")}</button>
        </div>
      ))}
    </div>
  );
}
