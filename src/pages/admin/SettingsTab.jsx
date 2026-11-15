import { useEffect, useState } from 'react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { toast } from '../../ui.jsx';
import { resetContact, telLink, waLink } from '../../lib/site.js';

export default function ContactAdmin() {
  const [f, setF] = useState({ email: '', phone: '', whatsapp: '' }), [ok, setOk] = useState(false), [busy, setBusy] = useState(false);
  useEffect(() => { getDoc(doc(db, 'settings', 'contact')).then((s) => { if (s.exists()) { const d = s.data(); setF({ email: d.email || '', phone: d.phone || '', whatsapp: d.whatsapp || '' }); } setOk(true); }).catch((e) => { toast('تعذر التحميل: ' + (e.code || e.message)); setOk(true); }); }, []);
  const save = async (e) => {
    e.preventDefault();
    const d = { email: f.email.trim(), phone: f.phone.trim(), whatsapp: f.whatsapp.trim() };
    if (d.email && !/^[^@ ]+@[^@ ]+\.[^@ ]+$/.test(d.email)) return toast('الإيميل مش مكتوب صح');
    for (const k of ['phone', 'whatsapp']) if (d[k] && !/^\+?[0-9 ]{6,20}$/.test(d[k])) return toast('الرقم لازم يكون أرقام بس (مثال: 01012345678)');
    setBusy(true);
    try { await setDoc(doc(db, 'settings', 'contact'), { ...d, updatedAt: serverTimestamp() }); resetContact(); toast('اتحفظت ✓ (بتظهر فوراً في زر التواصل)'); }
    catch (x) { toast('تعذر الحفظ: ' + (x.code || x.message)); }
    setBusy(false);
  };
  const inp = (k, l, ph, dir) => <label className="adm-f"><span>{l}</span><input className="fi" dir={dir} value={f[k]} placeholder={ph} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.value }))} /></label>;
  return (
    <form className="adm-card" onSubmit={save}>
      <h3>بيانات التواصل مع الموقع</h3>
      <p className="mu">اللي تكتبه هنا بيظهر لكل الزوار في زر التواصل العائم. اترك أي خانة فاضية لو مش عايز القناة دي تظهر.</p>
      {inp('email', 'إيميل التواصل', 'support@example.com', 'ltr')}
      {inp('whatsapp', 'رقم واتساب', '01012345678', 'ltr')}
      {inp('phone', 'رقم الاتصال الهاتفي', '01012345678', 'ltr')}
      <div className="row g"><button className="btn" disabled={busy || !ok}>{busy ? '…' : 'حفظ'}</button>
        {f.whatsapp && <a className="btn o" href={waLink(f.whatsapp)} target="_blank" rel="noreferrer">جرّب الواتساب</a>}
        {f.phone && <a className="btn o" href={telLink(f.phone)}>جرّب الاتصال</a>}</div>
    </form>
  );
}
