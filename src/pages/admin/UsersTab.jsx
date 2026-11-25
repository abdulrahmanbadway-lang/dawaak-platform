import { useDeferredValue, useMemo, useState } from 'react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from '../../firebase.js';
import { Badge, toast } from '../../ui.jsx';
import { PaginationBar, usePagination } from '../../lib/paginate.js';
import { errMsg } from '../../lib/errors.js';
import { RECOVERY_URL } from '../../lib/recovery.js';
import RecoveryModal from './RecoveryModal.jsx';
import { Chips, Dot, Empty, ROLE, Seg, TableSkel, ago, askConfirm, csvText, download, dt, ms } from './common.jsx';

export default function Users({ users, setUsers, sessions, now, onlineIds, meId }) {
  const [q, setQ] = useState(''), [role, setRole] = useState(''), [stt, setStt] = useState(''), [rec, setRec] = useState(null);
  const dq = useDeferredValue(q);
  const seen = useMemo(() => { const m = {}; sessions.forEach((s) => { if (s.uid) m[s.uid] = s; }); return m; }, [sessions]);
  const count = useMemo(() => {
    const c = { all: (users || []).length, blocked: 0, online: 0 };
    (users || []).forEach((u) => { if (u.blocked === true) c.blocked++; if (onlineIds.has(u.id)) c.online++; });
    return c;
  }, [users, onlineIds]);
  const rows = useMemo(() => {
    const t = dq.trim().toLowerCase();
    return (users || []).filter((u) => (!role || u.role === role)
      && (!stt || (stt === 'blocked' ? u.blocked === true : stt === 'active' ? u.blocked !== true : onlineIds.has(u.id)))
      && (!t || [u.name, u.email, u.phone].join(' ').toLowerCase().includes(t)))
      .sort((a, b) => (ms(b.createdAt) || 0) - (ms(a.createdAt) || 0));
  }, [users, role, stt, dq, onlineIds]);
  const pg = usePagination(rows, 25);
  const exp = () => download('dawaak-users.csv', csvText([['الاسم', 'البريد', 'الدور', 'محظور', 'تاريخ التسجيل', 'آخر ظهور', 'آخر IP', 'الجهاز'], ...rows.map((u) => { const s = seen[u.id]; return [u.name, u.email, ROLE[u.role] || u.role, u.blocked === true ? 'نعم' : '', dt(ms(u.createdAt)), s ? dt(s.t) : '', s?.ip || '', s?.dev || '']; })]));
  const block = async (u) => {
    const on = u.blocked !== true;
    const ok = await askConfirm(on
      ? { title: `حظر ${u.name}؟`, text: 'مش هيقدر يعمل طلبات ولا روشتات ولا يعدّل حاجة، وهيتم منعه من الكتابة وقراءة الطلبات والروشتات.', ok: 'حظر', danger: true }
      : { title: `فك الحظر عن ${u.name}؟`, text: 'الحساب هيرجع يشتغل عادي.', ok: 'فك الحظر' });
    if (!ok) return;
    try {
      await updateDoc(doc(db, 'users', u.id), { blocked: on, blockedAt: serverTimestamp() });
      setUsers((l) => l.map((x) => (x.id === u.id ? { ...x, blocked: on } : x))); toast(on ? `تم حظر ${u.name} ✓` : `تم فك الحظر عن ${u.name} ✓`);
    } catch (e) { toast('تعذر التنفيذ: ' + errMsg(e)); }
  };
  const setAdmin = async (u, on) => {
    const ok = await askConfirm(on
      ? { title: `ترقية ${u.name} لأدمن؟`, text: `${u.email}\nهيبقى له كل صلاحياتك: يشوف كل البيانات، يحظر ويوثّق ويحذف ويرقّي أدمن تاني. اعمل كده بس لشخص موثوق تمامًا.`, ok: 'ترقية لأدمن', danger: true, type: 'أدمن' }
      : { title: `سحب صلاحية الأدمن من ${u.name}؟`, text: 'هيرجع حساب مريض عادي.', ok: 'سحب الصلاحية', danger: true });
    if (!ok) return;
    try {
      await updateDoc(doc(db, 'users', u.id), { role: on ? 'admin' : 'patient' });
      setUsers((l) => l.map((x) => (x.id === u.id ? { ...x, role: on ? 'admin' : 'patient' } : x))); toast(on ? `${u.name} بقى أدمن ✓` : `تم سحب الأدمن من ${u.name} ✓`);
    } catch (e) { toast('تعذر التنفيذ: ' + errMsg(e)); }
  };
  const reset = async (u) => {
    if (!(await askConfirm({ title: 'إرسال رابط كلمة السر', text: `هيتبعت رابط تعيين كلمة سر جديدة على ${u.email}`, ok: 'إرسال الرابط' }))) return;
    try { await sendPasswordResetEmail(auth, u.email); toast('اتبعت الرابط على ' + u.email + ' ✓'); }
    catch (e) { toast('تعذر الإرسال: ' + errMsg(e)); }
  };
  return (
    <>
      <Chips items={[['الكل', count.all], ['متصل دلوقتي', count.online, 'gr'], ['محظور', count.blocked, count.blocked ? 'rd' : '']]} />
      <div className="row g wrap adm-bar">
        <input className="fi adm-q" placeholder="ابحث بالاسم أو البريد أو الرقم…" aria-label="بحث في المستخدمين" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="fi sel" aria-label="الدور" value={role} onChange={(e) => setRole(e.target.value)}><option value="">كل الأدوار</option>{Object.entries(ROLE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <Seg v={stt} on={setStt} opts={[['', 'الكل'], ['active', 'نشط'], ['blocked', 'محظور'], ['online', 'متصل']]} />
        <button className="btn o sm" onClick={exp}>تصدير CSV ({rows.length})</button>
      </div>
      {!users ? <TableSkel /> : !rows.length ? <div className="card"><Empty>{q || role || stt ? 'مفيش نتايج بالفلاتر دي' : 'مفيش مستخدمين'}</Empty></div> : (
        <div className="card adm-tw">
          <table className="adm-t"><thead><tr><th></th><th>الاسم</th><th>البريد</th><th>الدور</th><th>سجّل</th><th>آخر ظهور</th><th>المنطقة</th><th>إجراءات</th></tr></thead>
            <tbody>{pg.pageItems.map((u) => { const s = seen[u.id], locked = u.role === 'admin' || u.id === meId; return (
              <tr key={u.id} className={u.blocked === true ? 'adm-blk' : ''}><td><Dot on={onlineIds.has(u.id)} /></td><td><b>{u.name}</b> {u.id === meId && <Badge>أنت</Badge>} {u.blocked === true && <Badge c="rd">محظور</Badge>}</td><td dir="ltr" className="mu">{u.email}{u.phone && <div>{u.phone}</div>}</td><td><Badge c={u.role === 'admin' ? 'am' : ''}>{ROLE[u.role] || u.role}</Badge></td>
                <td className="mu">{dt(ms(u.createdAt))}</td><td>{s ? ago(s.t, now) : <span className="mu">لسه ما دخلش بعد التحديث</span>}</td>
                <td>{s?.gov ? (s.lat != null ? <a href={`https://www.google.com/maps?q=${s.lat},${s.lng}`} target="_blank" rel="noreferrer" title="موقع تقريبي">{s.gov}</a> : s.gov) : <span className="mu">—</span>}</td>
                <td><div className="row g"><button className="btn o sm" onClick={() => reset(u)} title="يبعت رابط تعيين كلمة سر على بريده">رابط كلمة السر</button>
                  {u.role !== 'admin' && <button className="btn o sm" disabled={!RECOVERY_URL} title={RECOVERY_URL ? 'يولّد رابط تعيين كلمة سر تبعته على واتساب (لو نسي الإيميل)' : 'الاسترجاع مش مفعّل: اضبط VITE_RECOVERY_URL'} onClick={() => setRec(u)}>استرجاع</button>}
                  <button className={'btn sm' + (u.blocked === true ? ' g' : ' o')} disabled={locked} title={locked ? 'مينفعش حظر الأدمن أو حسابك' : ''} onClick={() => block(u)}>{u.blocked === true ? 'فك الحظر' : 'حظر'}</button>
                  {u.role === 'patient' && u.blocked !== true && <button className="btn sm" title="يدّيه كل صلاحيات الأدمن" onClick={() => setAdmin(u, true)}>ترقية لأدمن</button>}
                  {u.role === 'admin' && u.id !== meId && <button className="btn o sm" title="يرجّعه حساب مريض" onClick={() => setAdmin(u, false)}>سحب الأدمن</button>}</div></td></tr>); })}</tbody></table>
        </div>)}
      <PaginationBar {...pg} />
      {rec && <RecoveryModal u={rec} onClose={() => setRec(null)} />}
      <p className="mu sm2">كلمات المرور مش بتتخزّن في أي مكان مقروء (Firebase بيشفّرها ومحدش يقدر يشوفها، ولا حتى الأدمن). لو مستخدم نسي كلمته اضغط "رابط كلمة السر" وهيوصله إيميل لتعيين كلمة جديدة.
        الحظر بيمنع الحساب فعليًا من الكتابة وقراءة الطلبات والروشتات (بقواعد Firestore)، لكن مقدرش أمنعه من تسجيل حساب جديد بإيميل تاني.
        الترقية لأدمن بتتم من حسابات المرضى بس، وبتطلب كتابة كلمة تأكيد، ومينفعش تسحب الأدمن من نفسك.</p>
    </>
  );
}
