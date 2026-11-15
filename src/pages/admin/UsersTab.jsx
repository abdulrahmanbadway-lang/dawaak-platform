import { useMemo, useState } from 'react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from '../../firebase.js';
import { Badge, toast } from '../../ui.jsx';
import { Dot, Empty, ROLE, ago, csvText, download, dt, ms } from './common.jsx';

export default function Users({ users, setUsers, sessions, now, onlineIds, meId }) {
  const [q, setQ] = useState(''), [role, setRole] = useState('');
  const seen = useMemo(() => { const m = {}; sessions.forEach((s) => { if (s.uid) m[s.uid] = s; }); return m; }, [sessions]);
  const rows = (users || []).filter((u) => (!role || u.role === role) && (!q || [u.name, u.email].join(' ').toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => (ms(b.createdAt) || 0) - (ms(a.createdAt) || 0));
  const exp = () => download('dawaak-users.csv', csvText([['الاسم', 'البريد', 'الدور', 'محظور', 'تاريخ التسجيل', 'آخر ظهور', 'آخر IP', 'الجهاز'], ...rows.map((u) => { const s = seen[u.id]; return [u.name, u.email, ROLE[u.role] || u.role, u.blocked === true ? 'نعم' : '', dt(ms(u.createdAt)), s ? dt(s.t) : '', s?.ip || '', s?.dev || '']; })]));
  const block = async (u) => {
    const on = u.blocked !== true;
    if (!confirm(on ? `حظر ${u.name}؟\nمش هيقدر يعمل طلبات ولا روشتات ولا يعدّل حاجة، وهيتم تسجيل خروجه.` : `فك الحظر عن ${u.name}؟`)) return;
    try {
      await updateDoc(doc(db, 'users', u.id), { blocked: on, blockedAt: serverTimestamp() });
      setUsers((l) => l.map((x) => (x.id === u.id ? { ...x, blocked: on } : x))); toast(on ? 'تم الحظر ✓' : 'تم فك الحظر ✓');
    } catch (e) { toast('تعذر التنفيذ: ' + (e.code || e.message)); }
  };
  const setAdmin = async (u, on) => {
    if (!confirm(on ? `ترقية ${u.name} (${u.email}) لأدمن؟\nهيبقى له كل صلاحياتك: يشوف كل البيانات، يحظر ويحذف ويرقّي أدمن تاني.` : `سحب صلاحية الأدمن من ${u.name}؟ هيرجع حساب مريض.`)) return;
    try {
      await updateDoc(doc(db, 'users', u.id), { role: on ? 'admin' : 'patient' });
      setUsers((l) => l.map((x) => (x.id === u.id ? { ...x, role: on ? 'admin' : 'patient' } : x))); toast(on ? 'تمت الترقية لأدمن ✓' : 'تم سحب الصلاحية ✓');
    } catch (e) { toast('تعذر التنفيذ: ' + (e.code || e.message)); }
  };
  const reset = async (u) => {
    if (!confirm(`نبعت رابط تعيين كلمة سر جديدة على ${u.email}؟`)) return;
    try { await sendPasswordResetEmail(auth, u.email); toast('اتبعت الرابط على ' + u.email); }
    catch (e) { toast('تعذر الإرسال: ' + (e.code || e.message)); }
  };
  return (
    <>
      <div className="row g wrap adm-bar">
        <input className="fi adm-q" placeholder="ابحث بالاسم أو البريد…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="fi sel" value={role} onChange={(e) => setRole(e.target.value)}><option value="">كل الأدوار</option>{Object.entries(ROLE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <button className="btn o sm" onClick={exp}>تصدير CSV ({rows.length})</button>
      </div>
      <div className="card adm-tw">{!users ? <Empty>جاري التحميل…</Empty> : !rows.length ? <Empty>مفيش نتايج</Empty> :
        <table className="adm-t"><thead><tr><th></th><th>الاسم</th><th>البريد</th><th>الدور</th><th>سجّل</th><th>آخر ظهور</th><th>آخر IP</th><th>المنطقة</th><th>الجهاز</th><th>إجراءات</th></tr></thead>
          <tbody>{rows.map((u) => { const s = seen[u.id], locked = u.role === 'admin' || u.id === meId; return (
            <tr key={u.id} className={u.blocked === true ? 'adm-blk' : ''}><td><Dot on={onlineIds.has(u.id)} /></td><td><b>{u.name}</b> {u.blocked === true && <Badge c="rd">محظور</Badge>}</td><td dir="ltr" className="mu">{u.email}</td><td><Badge c={u.role === 'admin' ? 'am' : ''}>{ROLE[u.role] || u.role}</Badge></td>
              <td className="mu">{dt(ms(u.createdAt))}</td><td>{s ? ago(s.t, now) : <span className="mu">لسه ما دخلش بعد التحديث</span>}</td><td dir="ltr">{s?.ip || '—'}{s?.cc ? ' · ' + s.cc : ''}</td><td>{s?.gov ? (s.lat != null ? <a href={`https://www.google.com/maps?q=${s.lat},${s.lng}`} target="_blank" rel="noreferrer" title="موقع تقريبي">{s.gov}</a> : s.gov) : <span className="mu">—</span>}</td><td className="mu">{s?.dev || '—'}</td>
              <td><div className="row g"><button className="btn o sm" onClick={() => reset(u)} title="يبعت رابط تعيين كلمة سر على بريده">رابط كلمة السر</button>
                <button className={'btn sm' + (u.blocked === true ? ' g' : ' o')} disabled={locked} title={locked ? 'مينفعش حظر الأدمن أو حسابك' : ''} onClick={() => block(u)}>{u.blocked === true ? 'فك الحظر' : 'حظر'}</button>
                {u.role === 'patient' && u.blocked !== true && <button className="btn sm" title="يدّيه كل صلاحيات الأدمن" onClick={() => setAdmin(u, true)}>ترقية لأدمن</button>}
                {u.role === 'admin' && u.id !== meId && <button className="btn o sm" title="يرجّعه حساب مريض" onClick={() => setAdmin(u, false)}>سحب الأدمن</button>}</div></td></tr>); })}</tbody></table>}</div>
      <p className="mu sm2">كلمات المرور مش بتتخزّن في أي مكان مقروء (Firebase بيشفّرها ومحدش يقدر يشوفها، ولا حتى الأدمن). لو مستخدم نسي كلمته اضغط "رابط كلمة السر" وهيوصله إيميل لتعيين كلمة جديدة.
        الحظر بيمنع الحساب فعليًا من الكتابة وقراءة الطلبات والروشتات (بقواعد Firestore)، لكن مقدرش أمنعه من تسجيل حساب جديد بإيميل تاني.
        لإضافة أدمن: خلّي الشخص يسجّل حساب مريض عادي من الموقع، وبعدين اضغط "ترقية لأدمن" قدّام اسمه. الترقية بتتم من حسابات المرضى بس، ومينفعش تسحب الأدمن من نفسك.</p>
    </>
  );
}
