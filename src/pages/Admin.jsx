import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, getDocs, onSnapshot, query, orderBy, limit, updateDoc, deleteDoc, addDoc, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { db, auth } from '../firebase.js';
import { useAuth } from '../auth.jsx';
import { RX_LABEL, RX_TONE } from '../lib/status.js';
import { toast, Badge } from '../ui.jsx';
import { Icon } from '../icons.jsx';
import { bannerImage } from '../lib/img.js';
import { nearestGov } from '../lib/egypt.js';
import '../admin.css';

const ON_MS = 120000, RECENT_MS = 15 * 60000, STALE_MS = 24 * 3600000;
const ms = (t) => (t && typeof t.toMillis === 'function' ? t.toMillis() : typeof t === 'number' ? t : null);
const ROLE = { patient: 'مريض', pharmacy: 'صيدلية', courier: 'مندوب', admin: 'أدمن' };
const ST = { new: 'جديد', preparing: 'قيد التحضير', out: 'في الطريق', done: 'تم التسليم', cancelled: 'ملغي' };
const ST_C = { new: 'am', cancelled: 'rd' };
const PAGES = [['/search', 'البحث عن دوا'], ['/orders', 'طلباتي'], ['/rx', 'الروشتات'], ['/pharmacy', 'لوحة الصيدلية'], ['/courier', 'صفحة المندوب'], ['/track', 'تتبع طلب'], ['/login', 'تسجيل الدخول'], ['/register', 'إنشاء حساب'], ['/admin', 'لوحة التحكم']];
const pageName = (p = '/') => (p === '/' ? 'الرئيسية' : (PAGES.find(([k]) => p.startsWith(k)) || [0, p])[1]);
const ago = (t, now) => {
  if (!t) return '—';
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 45) return 'الآن';
  if (s < 3600) return 'قبل ' + Math.round(s / 60) + ' د';
  if (s < 86400) return 'قبل ' + Math.round(s / 3600) + ' س';
  return new Date(t).toLocaleDateString('en-GB');
};
const dt = (t) => (t ? new Date(t).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const money = (n) => (Math.round(n) || 0).toLocaleString('en-US') + ' ج.م';
const dayKey = (t) => new Date(t).toDateString();

function csvText(rows) {
  const esc = (v) => { let s = String(v ?? ''); if (/^[=+\-@]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  return '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n');
}
function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}
function useNow(step) {
  const [n, setN] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setN(Date.now()), step); return () => clearInterval(t); }, [step]);
  return n;
}

function useData() {
  const [pres, setPres] = useState(null), [orders, setOrders] = useState(null), [users, setUsers] = useState(null), [phs, setPhs] = useState(null), [err, setErr] = useState('');
  const loadStatic = useCallback(async () => {
    try {
      const [u, p] = await Promise.all([getDocs(collection(db, 'users')), getDocs(collection(db, 'pharmacies'))]);
      setUsers(u.docs.map((d) => ({ id: d.id, ...d.data() }))); setPhs(p.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) { setErr(e.code || e.message); }
  }, []);
  useEffect(() => {
    loadStatic();
    const bad = (e) => setErr(e.code || e.message);
    const a = onSnapshot(query(collection(db, 'presence'), orderBy('lastSeen', 'desc'), limit(300)), (s) => setPres(s.docs.map((d) => ({ id: d.id, ...d.data() }))), bad);
    const b = onSnapshot(query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(200)), (s) => setOrders(s.docs.map((d) => ({ id: d.id, ...d.data() }))), bad);
    return () => { a(); b(); };
  }, [loadStatic]);
  return { pres, orders, users, phs, err, reload: loadStatic, setPhs, setUsers };
}

const Kpi = ({ ic, tone = '', v, l, sub }) => (
  <div className="adm-k"><i className={'adm-ki ' + tone}><Icon n={ic} s={22} /></i><div><b>{v}</b><span>{l}</span>{sub && <small>{sub}</small>}</div></div>
);
const Empty = ({ children }) => <div className="adm-empty">{children}</div>;
const Dot = ({ on }) => <i className={'adm-dot' + (on ? ' on' : '')} title={on ? 'متصل الآن' : 'غير متصل'} />;

function Overview({ sessions, online, users, phs, orders, now }) {
  const day0 = new Date(now); day0.setHours(0, 0, 0, 0);
  const today = (orders || []).filter((o) => ms(o.createdAt) >= day0.getTime());
  const active = (orders || []).filter((o) => ['new', 'preparing', 'out'].includes(o.status));
  const sales = (orders || []).filter((o) => o.status === 'done').reduce((s, o) => s + (o.total || 0), 0);
  const members = online.filter((s) => s.uid).length;
  const by = (r) => (users || []).filter((u) => u.role === r).length;
  const pending = (phs || []).filter((p) => !p.verified).length;
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(day0); d.setDate(d.getDate() - (6 - i)); return d; });
  const bars = days.map((d) => ({ d, n: (orders || []).filter((o) => ms(o.createdAt) && dayKey(ms(o.createdAt)) === d.toDateString()).length }));
  const max = Math.max(1, ...bars.map((b) => b.n));
  const feed = [
    ...(orders || []).flatMap((o) => {
      const c = ms(o.createdAt), u = ms(o.updatedAt);
      const e = [{ t: c, ic: 'bag', tx: `طلب جديد من ${o.patientName || '—'} لصيدلية ${o.pharmacyName || '—'} (${money(o.total)})` }];
      if (u && c && u - c > 5000 && o.status !== 'new') e.push({ t: u, ic: o.status === 'out' ? 'truck' : o.status === 'done' ? 'check' : o.status === 'cancelled' ? 'x' : 'clock', tx: `الطلب ${o.id.slice(0, 6)} (${o.patientName || '—'}) ← ${ST[o.status] || o.status}` });
      return e;
    }),
    ...(users || []).map((u) => ({ t: ms(u.createdAt), ic: 'user', tx: `انضم ${u.name} (${ROLE[u.role] || u.role})` })),
  ].filter((e) => e.t).sort((a, b) => b.t - a.t).slice(0, 14);
  return (
    <>
      <div className="adm-grid">
        <Kpi ic="bolt" tone="gr" v={online.length} l="على الموقع دلوقتي" sub={`${members} مسجّل · ${online.length - members} زائر`} />
        <Kpi ic="clock" v={sessions.filter((s) => now - s.t <= RECENT_MS).length} l="نشطين آخر 15 دقيقة" />
        <Kpi ic="users" v={users ? users.length : '…'} l="إجمالي المستخدمين" sub={`${by('patient')} مريض · ${by('pharmacy')} صيدلية · ${by('courier')} مندوب`} />
        <Kpi ic="store" tone={pending ? 'am' : ''} v={phs ? phs.length : '…'} l="الصيدليات" sub={pending ? `${pending} في انتظار التوثيق` : 'كلها موثّقة'} />
        <Kpi ic="bag" v={today.length} l="طلبات النهارده" sub={`${active.length} قيد التنفيذ دلوقتي`} />
        <Kpi ic="check" tone="gr" v={money(sales)} l="مبيعات مسلّمة" sub="من آخر 200 طلب" />
      </div>
      <div className="adm-two">
        <section className="card"><h3>الطلبات آخر 7 أيام</h3>
          <div className="adm-bars">{bars.map((b) => <div key={b.d.getTime()} className="bar"><span>{b.n}</span><i style={{ height: Math.max(4, (b.n / max) * 100) + '%' }} /><small>{b.d.toLocaleDateString('ar-EG', { weekday: 'short' })}</small></div>)}</div>
        </section>
        <section className="card"><h3>آخر الأحداث</h3>
          <p className="mu sm2">من الطلبات وتسجيل الحسابات (مش من تتبع الصفحات).</p>
          {feed.length ? <ul className="adm-feed">{feed.map((e, i) => <li key={i}><i><Icon n={e.ic} s={16} /></i><span>{e.tx}</span><small>{ago(e.t, now)}</small></li>)}</ul> : <Empty>مفيش أحداث لسه</Empty>}
        </section>
      </div>
    </>
  );
}

function Live({ sessions, online, recent, now }) {
  const [f, setF] = useState('all');
  const show = (l) => l.filter((s) => (f === 'all' ? true : f === 'm' ? s.uid : !s.uid));
  const row = (s, on) => (
    <li key={s.id} className="adm-s">
      <Dot on={on} />
      <span className="adm-av">{(s.name || '?')[0]}</span>
      <div className="adm-sm"><b>{s.name}</b> {s.role && <Badge c={s.role === 'admin' ? 'am' : ''}>{ROLE[s.role] || s.role}</Badge>}
        <div className="mu sm2">{s.mobile ? 'موبايل' : 'كمبيوتر'}{s.dev ? ' · ' + s.dev : ''}</div></div>
      <div className="adm-sp"><span className="adm-chip"><Icon n="pin" s={13} />{pageName(s.path)}</span></div>
      <div className="adm-si">{s.ip ? <span dir="ltr"><b>{s.ip}</b>{s.cc ? <small> · {s.cc}</small> : null}</span> : <span className="mu">IP غير متاح</span>}</div>
      <div className="adm-st mu sm2">{ago(s.t, now)}</div>
    </li>
  );
  const nOn = show(online), nRec = show(recent);
  return (
    <>
      <div className="row between wrap g adm-bar">
        <h3>على الموقع دلوقتي ({online.length})</h3>
        <div className="adm-seg">{[['all', 'الكل'], ['m', 'مسجّلين'], ['v', 'زوار']].map(([k, l]) => <button key={k} className={f === k ? 'on' : ''} onClick={() => setF(k)}>{l}</button>)}</div>
      </div>
      <div className="adm-chips"><span>موبايل: <b>{online.filter((s) => s.mobile).length}</b></span><span>كمبيوتر: <b>{online.filter((s) => !s.mobile).length}</b></span><span>الإجمالي المسجّل: <b>{sessions.length}</b></span></div>
      <div className="card adm-list">{nOn.length ? <ul>{nOn.map((s) => row(s, true))}</ul> : <Empty>مفيش حد على الموقع دلوقتي</Empty>}</div>
      <h3 className="mt">كانوا نشطين (آخر 15 دقيقة)</h3>
      <div className="card adm-list">{nRec.length ? <ul>{nRec.map((s) => row(s, false))}</ul> : <Empty>مفيش</Empty>}</div>
      <p className="mu sm2">المتصل = آخر نبضة خلال دقيقتين. النبضة بتتبعت كل دقيقة والتبويب ظاهر وعند تغيير الصفحة. عنوان الـ IP بيتجاب من المتصفح (مش مضمون).</p>
    </>
  );
}

function Users({ users, setUsers, sessions, now, onlineIds, meId }) {
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

function BannersAdmin() {
  const E = { title: '', sub: '', link: '', imageUrl: '', active: true };
  const [rows, setRows] = useState(null), [f, setF] = useState(E), [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const s = await getDocs(query(collection(db, 'banners'), limit(50)));
    setRows(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order || 0) - (b.order || 0)));
  }, []);
  useEffect(() => { load().catch((e) => toast('تعذر تحميل الإعلانات: ' + (e.code || e.message))); }, [load]);
  const pick = async (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    try { setF((x) => ({ ...x, imageUrl: '' })); const d = await bannerImage(file); setF((x) => ({ ...x, imageUrl: d })); }
    catch (x) { toast(x.message); }
  };
  const add = async (e) => {
    e.preventDefault();
    const title = f.title.trim(), sub = f.sub.trim(), link = f.link.trim();
    if (!f.imageUrl && !title) return toast('اكتب عنوان أو ارفع صورة');
    if (link && !/^(#\/|https:\/\/)/.test(link)) return toast('الرابط لازم يبدأ بـ https:// أو #/ (صفحة داخل الموقع)');
    setBusy(true);
    try {
      const order = Math.max(0, ...(rows || []).map((r) => r.order || 0)) + 1;
      await addDoc(collection(db, 'banners'), { title, sub, link, imageUrl: f.imageUrl, order, active: f.active, createdAt: serverTimestamp() });
      setF(E); toast('تمت إضافة الإعلان ✓'); await load();
    } catch (x) { toast('تعذر الحفظ: ' + (x.code || x.message)); } finally { setBusy(false); }
  };
  const upd = async (b, patch) => {
    try { await updateDoc(doc(db, 'banners', b.id), patch); setRows((l) => l.map((x) => (x.id === b.id ? { ...x, ...patch } : x))); }
    catch (x) { toast('تعذر التعديل: ' + (x.code || x.message)); }
  };
  const move = async (k, d) => {
    const a = rows[k], b = rows[k + d]; if (!a || !b) return;
    const oa = a.order || 0, ob = b.order || 0, same = oa === ob;
    await upd(a, { order: same ? ob + d : ob }); await upd(b, { order: oa }); await load();
  };
  const del = async (b) => {
    if (!confirm('حذف الإعلان ده؟')) return;
    try { await deleteDoc(doc(db, 'banners', b.id)); setRows((l) => l.filter((x) => x.id !== b.id)); toast('تم الحذف ✓'); }
    catch (x) { toast('تعذر الحذف: ' + (x.code || x.message)); }
  };
  return (
    <>
      <form className="card" onSubmit={add} style={{ padding: 18, marginBottom: 14 }}>
        <h3>إضافة إعلان للرئيسية</h3>
        <div className="row g wrap" style={{ marginTop: 8 }}>
          <input className="fi" style={{ flex: '1 1 220px' }} maxLength={80} placeholder="العنوان (اختياري لو في صورة)" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <input className="fi" style={{ flex: '2 1 260px' }} maxLength={160} placeholder="سطر توضيحي (اختياري)" value={f.sub} onChange={(e) => setF({ ...f, sub: e.target.value })} />
        </div>
        <div className="row g wrap" style={{ marginTop: 8 }}>
          <input className="fi" dir="ltr" style={{ flex: '1 1 260px' }} placeholder="الرابط عند الضغط: #/search?cat=… أو https://…" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} />
          <label className="btn o sm" style={{ cursor: 'pointer' }}>{f.imageUrl ? 'تغيير الصورة' : 'رفع صورة'}<input type="file" accept="image/*" hidden onChange={pick} /></label>
          <label className="row g" style={{ gap: 6 }}><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> ظاهر</label>
        </div>
        {f.imageUrl && <img src={f.imageUrl} alt="" style={{ marginTop: 10, width: '100%', maxWidth: 420, borderRadius: 14, aspectRatio: '1000/375', objectFit: 'cover' }} />}
        <p className="mu sm2" style={{ marginTop: 8 }}>الصورة بتتقصّ تلقائي بنسبة 1000×375 وتتضغط. لو مفيش إعلانات خالص، الرئيسية بتعرض 3 إعلانات جاهزة عن مزايا الموقع (الروشتة، التتبّع، تسجيل الصيدليات).</p>
        <button className="btn" disabled={busy} style={{ marginTop: 8 }}>{busy ? '…' : 'إضافة الإعلان'}</button>
      </form>
      <div className="card adm-tw">{!rows ? <Empty>جاري التحميل…</Empty> : !rows.length ? <Empty>مفيش إعلانات. الرئيسية بتعرض الإعلانات الجاهزة.</Empty> :
        <table className="adm-t"><thead><tr><th></th><th>الإعلان</th><th>الرابط</th><th>الحالة</th><th>إجراءات</th></tr></thead>
          <tbody>{rows.map((b, k) => (
            <tr key={b.id} className={b.active === false ? 'adm-blk' : ''}>
              <td><div className="adm-th" style={{ width: 96 }}>{b.imageUrl ? <img src={b.imageUrl} alt="" /> : <Icon n="star" s={18} />}</div></td>
              <td><b>{b.title || '(صورة فقط)'}</b><div className="mu sm2">{b.sub}</div></td><td dir="ltr" className="mu">{b.link || '—'}</td>
              <td>{b.active === false ? <Badge c="am">مخفي</Badge> : <Badge c="ok">ظاهر</Badge>}</td>
              <td><div className="row g"><button className="btn o sm" disabled={k === 0} onClick={() => move(k, -1)}>▲</button><button className="btn o sm" disabled={k === rows.length - 1} onClick={() => move(k, 1)}>▼</button>
                <button className="btn o sm" onClick={() => upd(b, { active: b.active === false })}>{b.active === false ? 'إظهار' : 'إخفاء'}</button><button className="btn o sm" onClick={() => del(b)}>حذف</button></div></td></tr>))}</tbody></table>}</div>
    </>
  );
}

function ProductsAdmin({ phs }) {
  const [rows, setRows] = useState(null), [q, setQ] = useState(''), [ph, setPh] = useState('');
  const load = useCallback(async () => {
    const s = await getDocs(query(collection(db, 'products'), limit(500)));
    setRows(s.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, []);
  useEffect(() => { load().catch((e) => toast('تعذر تحميل المنتجات: ' + (e.code || e.message))); }, [load]);
  const nameOf = (id) => (phs || []).find((p) => p.id === id)?.name || id.slice(0, 6);
  const del = async (p) => {
    if (!confirm(`حذف "${p.name}" من ${nameOf(p.pharmacyId)}؟\nالحذف نهائي.`)) return;
    try { await deleteDoc(doc(db, 'products', p.id)); setRows((l) => l.filter((x) => x.id !== p.id)); toast('تم الحذف ✓'); }
    catch (e) { toast('تعذر الحذف: ' + (e.code || e.message)); }
  };
  const list = (rows || []).filter((p) => (!ph || p.pharmacyId === ph) && (!q || [p.name, p.ingredient].join(' ').toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ar'));
  return (
    <>
      <div className="row g wrap adm-bar">
        <input className="fi adm-q" placeholder="ابحث باسم المنتج أو المادة الفعالة…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="fi sel" value={ph} onChange={(e) => setPh(e.target.value)}><option value="">كل الصيدليات</option>{(phs || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <span className="mu sm2">{rows ? list.length + ' منتج' : ''}</span>
      </div>
      <div className="card adm-tw">{!rows ? <Empty>جاري التحميل…</Empty> : !list.length ? <Empty>مفيش منتجات</Empty> :
        <table className="adm-t"><thead><tr><th></th><th>المنتج</th><th>الصيدلية</th><th>التفاصيل</th><th>السعر</th><th>المخزون</th><th>صورة</th><th></th></tr></thead>
          <tbody>{list.map((p) => <tr key={p.id}>
            <td><span className="adm-th">{p.imageUrl ? <img src={p.imageUrl} alt="" loading="lazy" /> : <Icon n="pill" s={20} />}</span></td>
            <td><b>{p.name}</b> {p.rx && <Badge c="am">روشتة</Badge>}</td><td>{nameOf(p.pharmacyId)}</td>
            <td className="mu">{[p.dose, p.form, p.ingredient].filter(Boolean).join(' · ') || '—'}</td><td>{money(p.price)}</td>
            <td><Badge c={p.stock > 0 ? (p.stock < 5 ? 'am' : '') : 'rd'}>{p.stock > 0 ? p.stock : 'نفد'}</Badge></td>
            <td className="mu">{p.imageUrl ? 'فيه' : 'مفيش'}</td>
            <td><button className="btn o sm" onClick={() => del(p)}>حذف</button></td></tr>)}</tbody></table>}</div>
      <p className="mu sm2">بيعرض أول 500 منتج. الحذف نهائي، والقواعد بتسمح للأدمن بحذف أي منتج ولصاحب الصيدلية بحذف منتجه بس.</p>
    </>
  );
}

function RxAdmin({ now }) {
  const [rows, setRows] = useState(null), [st, setSt] = useState('');
  useEffect(() => {
    getDocs(query(collection(db, 'prescriptions'), orderBy('createdAt', 'desc'), limit(200)))
      .then((s) => setRows(s.docs.map((d) => ({ id: d.id, ...d.data() }))))
      .catch((e) => toast('تعذر تحميل الروشتات: ' + (e.code || e.message)));
  }, []);
  const list = (rows || []).filter((r) => !st || r.status === st);
  return (
    <>
      <div className="row g wrap adm-bar">
        <select className="fi sel" value={st} onChange={(e) => setSt(e.target.value)}><option value="">كل الحالات</option>{Object.entries(RX_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <span className="mu sm2">{rows ? list.length + ' روشتة' : ''}</span>
      </div>
      <div className="card adm-tw">{!rows ? <Empty>جاري التحميل…</Empty> : !list.length ? <Empty>مفيش روشتات</Empty> :
        <table className="adm-t"><thead><tr><th>#</th><th>المريض</th><th>الصيدلية</th><th>الحالة</th><th>الصور</th><th>عرض السعر</th><th>وقت الرفع</th></tr></thead>
          <tbody>{list.map((r) => <tr key={r.id}><td dir="ltr" className="mu">{r.id.slice(0, 6)}</td><td><b>{r.patientName}</b></td><td>{r.pharmacyName}</td>
            <td><Badge c={RX_TONE[r.status] || ''}>{RX_LABEL[r.status] || r.status}</Badge></td><td>{Array.isArray(r.images) ? r.images.length : 0}</td>
            <td>{r.quote?.total ? money(r.quote.total) : '—'}</td><td className="mu">{dt(ms(r.createdAt))} <small>({ago(ms(r.createdAt), now)})</small></td></tr>)}</tbody></table>}</div>
      <p className="mu sm2">بيعرض بيانات الروشتة بدون الصور عن قصد لخصوصية المرضى. تنبيه: قواعد Firestore بتسمح للأدمن بقراءة مستند الروشتة كامل (بما فيه الصور)، فاعتبر الصلاحية دي حساسة وما تديهاش لأي حد غيرك.</p>
    </>
  );
}

function Pharmacies({ phs, setPhs, users }) {
  const [q, setQ] = useState('');
  const act = async (p, patch) => {
    try { await updateDoc(doc(db, 'pharmacies', p.id), patch); setPhs((l) => l.map((x) => (x.id === p.id ? { ...x, ...patch } : x))); toast('تم ✓'); }
    catch (e) { toast('تعذر التنفيذ: ' + (e.code || e.message)); }
  };
  const email = (id) => (users || []).find((u) => u.id === id)?.email;
  const rows = (phs || []).filter((p) => !q || [p.name, p.governorate, p.license, p.ownerName].join(' ').toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (a.verified - b.verified) || (ms(b.createdAt) || 0) - (ms(a.createdAt) || 0));
  return (
    <>
      <div className="adm-bar"><input className="fi adm-q" placeholder="ابحث باسم الصيدلية أو المحافظة أو الترخيص…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {!phs ? <Empty>جاري التحميل…</Empty> : !rows.length ? <Empty>مفيش صيدليات</Empty> : rows.map((p) => (
        <div className="card adm-ph" key={p.id}>
          <div className="row between wrap g">
            <div><h3>{p.name} {p.verified ? <Badge>موثّقة</Badge> : <Badge c="am">في انتظار التوثيق</Badge>} {p.status === 'suspended' && <Badge c="rd">موقوفة</Badge>}</h3>
              <p className="mu sm2">{p.governorate} · {p.address}</p>
              <p className="sm2">المسؤول: {p.ownerName || '—'} · الترخيص: <b dir="ltr">{p.license || '—'}</b> · <span dir="ltr">{p.phone || '—'}</span>{email(p.id) ? <> · <span dir="ltr" className="mu">{email(p.id)}</span></> : null}</p></div>
            <div className="row g wrap">
              <button className={'btn sm' + (p.verified ? ' o' : ' g')} onClick={() => act(p, { verified: !p.verified })}>{p.verified ? 'إلغاء التوثيق' : 'توثيق'}</button>
              <button className="btn sm o" onClick={() => act(p, { status: p.status === 'suspended' ? 'active' : 'suspended' })}>{p.status === 'suspended' ? 'إعادة تفعيل' : 'إيقاف'}</button>
            </div>
          </div>
        </div>))}
      <p className="mu sm2">التوثيق والإيقاف بيتكتبوا فعليًا (والقواعد بتسمح للأدمن بتغيير الحقلين دول بس). الإيقاف بيخفي الصيدلية من نتايج البحث؛ مش بيمنع صاحبها من الدخول.</p>
    </>
  );
}

function Orders({ orders, now }) {
  const [q, setQ] = useState(''), [st, setSt] = useState('');
  const rows = (orders || []).filter((o) => (!st || o.status === st) && (!q || [o.patientName, o.pharmacyName, o.phone, o.id].join(' ').toLowerCase().includes(q.toLowerCase())));
  const exp = () => download('dawaak-orders.csv', csvText([['رقم', 'المريض', 'الصيدلية', 'الإجمالي', 'الحالة', 'المندوب', 'التاريخ'], ...rows.map((o) => [o.id, o.patientName, o.pharmacyName, o.total, ST[o.status] || o.status, o.courierName || '', dt(ms(o.createdAt))])]));
  return (
    <>
      <div className="row g wrap adm-bar">
        <input className="fi adm-q" placeholder="ابحث باسم المريض أو الصيدلية أو الموبايل…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="fi sel" value={st} onChange={(e) => setSt(e.target.value)}><option value="">كل الحالات</option>{Object.entries(ST).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <button className="btn o sm" onClick={exp}>تصدير CSV ({rows.length})</button>
      </div>
      <div className="card adm-tw">{!orders ? <Empty>جاري التحميل…</Empty> : !rows.length ? <Empty>مفيش طلبات</Empty> :
        <table className="adm-t"><thead><tr><th>#</th><th>المريض</th><th>الصيدلية</th><th>الإجمالي</th><th>الحالة</th><th>المندوب</th><th>وقت الطلب</th></tr></thead>
          <tbody>{rows.map((o) => <tr key={o.id}><td dir="ltr" className="mu">{o.id.slice(0, 6)}</td><td><b>{o.patientName}</b></td><td>{o.pharmacyName}</td><td>{money(o.total)}</td>
            <td><Badge c={ST_C[o.status] || ''}>{ST[o.status] || o.status}</Badge></td><td>{o.courierName || '—'}</td><td className="mu">{dt(ms(o.createdAt))} <small>({ago(ms(o.createdAt), now)})</small></td></tr>)}</tbody></table>}</div>
      <p className="mu sm2">بيعرض آخر 200 طلب. الروشتات (صور طبية) مش بتظهر للأدمن عن قصد، والقواعد كمان بتمنع قراءتها.</p>
    </>
  );
}

function System({ sessions, now }) {
  const [busy, setBusy] = useState(false);
  const stale = sessions.filter((s) => now - s.t > STALE_MS);
  const clean = async () => {
    if (!stale.length || !confirm(`مسح ${stale.length} سجل قديم (أقدم من 24 ساعة)؟`)) return;
    setBusy(true);
    try {
      for (let i = 0; i < stale.length; i += 400) { const b = writeBatch(db); stale.slice(i, i + 400).forEach((s) => b.delete(doc(db, 'presence', s.id))); await b.commit(); }
      toast('تم المسح ✓');
    } catch (e) { toast('تعذر المسح: ' + (e.code || e.message)); }
    setBusy(false);
  };
  return (
    <>
      <section className="card"><h3>تنضيف سجلات التواجد</h3>
        <p className="mu">كل زائر بيعمل سجل صغير. السجلات الأقدم من 24 ساعة ملهاش لزوم، ومسحها بيقلل القراءات في الحصة المجانية.</p>
        <button className="btn sm" disabled={busy || !stale.length} onClick={clean}>{busy ? '…' : `امسح السجلات القديمة (${stale.length})`}</button></section>
      <section className="card"><h3>حدود الخطة المجانية (Spark)</h3>
        <ul className="adm-ul"><li>الكتابة: 20,000 مستند/يوم. كل تبويب مفتوح بيكتب نبضة كل دقيقة (≈ 60 كتابة/ساعة لكل متصفح).</li>
          <li>القراءة: 50,000 مستند/يوم. فتح لوحة الأدمن وتحديثها بيحسب قراءات.</li>
          <li>لو عدّيت الحصة، Firebase بيرفض العمليات لحد اليوم الجاي (مش بيحاسبك لأن مفيش بطاقة).</li></ul></section>
      <section className="card"><h3>إزاي تعمل حساب أدمن</h3>
        <ol className="adm-ul"><li>سجّل حساب عادي من الموقع (مريض).</li><li>افتح Firebase Console ← Firestore ← مجموعة <b>users</b> ← مستند الحساب ده.</li><li>غيّر الحقل <b>role</b> إلى <b dir="ltr">admin</b> واحفظ، وبعدها سجّل خروج ودخول.</li></ol>
        <p className="mu sm2">مفيش طريقة من الموقع نفسه تخلّي حد أدمن: القواعد بترفض التسجيل أو التعديل بالدور ده.</p></section>
      <section className="card"><h3>الخصوصية</h3>
        <p className="mu">بنسجّل عنوان IP والصفحة الحالية والجهاز لأغراض الأمان والإحصاء، ومعروضين للأدمن بس. نصيحة: اذكر ده في سياسة الخصوصية بتاعة المشروع.</p></section>
    </>
  );
}


// ───── المناطق: مين فين، وعايزين إيه (بيانات تقريبية: المحافظة + إحداثيات متقرّبة لحوالي 1 كم، وبس للي سمح بالموقع) ─────
const topN = (m, n = 8) => Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n);
function AreasAdmin({ sessions, orders, users, phs, now }) {
  const [dem, setDem] = useState(null), [sel, setSel] = useState(''), [err, setErr] = useState('');
  useEffect(() => {
    getDocs(query(collection(db, 'demand'), limit(600))).then((s) => setDem(s.docs.map((d) => ({ id: d.id, ...d.data() })))).catch((e) => setErr(e.code || e.message));
  }, []);
  const byGov = useMemo(() => {
    const m = {}; const g = (n) => (m[n] ||= { gov: n, vis: new Set(), ord: 0, q: 0, ph: 0 });
    (sessions || []).forEach((s) => { if (s.gov) g(s.gov).vis.add(s.id); });
    (orders || []).forEach((o) => { const n = o.dest && typeof o.dest.lat === 'number' ? nearestGov(o.dest.lat, o.dest.lng) : ''; if (n) g(n).ord++; });
    (dem || []).forEach((d) => { if (d.k === 'q') g(d.gov).q += d.n || 0; });
    (phs || []).forEach((p) => { if (p.governorate) g(p.governorate).ph++; });
    return Object.values(m).sort((a, b) => (b.vis.size + b.ord) - (a.vis.size + a.ord));
  }, [sessions, orders, dem, phs]);
  const located = (sessions || []).filter((s) => s.gov).length;
  const det = useMemo(() => {
    if (!sel) return null;
    const q = {}, c = {}, o = {};
    (dem || []).filter((d) => d.gov === sel).forEach((d) => { (d.k === 'q' ? q : c)[d.term] = d.n || 0; });
    (orders || []).forEach((r) => { const n = r.dest && typeof r.dest.lat === 'number' ? nearestGov(r.dest.lat, r.dest.lng) : ''; if (n === sel) (r.items || []).forEach((i) => { o[i.name] = (o[i.name] || 0) + (i.qty || 1); }); });
    return { q: topN(q), c: topN(c), o: topN(o), users: (sessions || []).filter((s) => s.gov === sel) };
  }, [sel, dem, orders, sessions]);
  const List = ({ t, rows, u }) => (<div className="card"><h3>{t}</h3>{!rows.length ? <p className="mu sm2">لسه مفيش بيانات</p> : <ol className="adm-rank">{rows.map(([k, n]) => <li key={k}><span>{k}</span><b>{n} {u}</b></li>)}</ol>}</div>);
  if (err) return <Empty>مش قادر أقرأ بيانات الاحتياج: {/permission/i.test(err) ? 'انشر قواعد Firestore الجديدة (firebase deploy --only firestore:rules).' : err}</Empty>;
  return (
    <>
      <div className="adm-grid"><Kpi ic="pin" tone="" v={located} l="جلسات حدّدت موقعها" sub="أو اختارت محافظتها" /><Kpi ic="store" tone="gr" v={byGov.filter((x) => x.vis.size).length} l="محافظات فيها زوار" /><Kpi ic="bag" v={byGov.filter((x) => x.ord).length} l="محافظات فيها طلبات" /></div>
      <p className="mu sm2">المنطقة تقريبية (أقرب محافظة لإحداثيات الجهاز) وبتتسجّل بس لو الزائر وافق على الموقع أو اختار محافظته. الإحداثيات بتتخزّن متقرّبة لحوالي 1 كم. كلمات البحث عدّادات مجمّعة بدون أي بيانات شخصية.</p>
      <div className="card adm-tw">{!byGov.length ? <Empty>لسه مفيش بيانات مناطق. أول ما زوار يسمحوا بالموقع هتظهر هنا.</Empty> :
        <table className="adm-t"><thead><tr><th>المحافظة</th><th>زوار/مستخدمين</th><th>طلبات</th><th>مرات البحث</th><th>صيدليات</th><th></th></tr></thead>
          <tbody>{byGov.map((r) => <tr key={r.gov} className={sel === r.gov ? 'adm-sel' : ''}><td><b>{r.gov}</b></td><td>{r.vis.size}</td><td>{r.ord}</td><td>{r.q}</td><td>{r.ph}</td><td><button className="btn o sm" onClick={() => setSel(sel === r.gov ? '' : r.gov)}>{sel === r.gov ? 'إخفاء' : 'التفاصيل'}</button></td></tr>)}</tbody></table>}</div>
      {det && <>
        <h2 className="mt">احتياج {sel}</h2>
        <div className="adm-grid"><List t="الأكتر بحثاً" rows={det.q} u="مرة" /><List t="الأكتر إضافة للسلة" rows={det.c} u="مرة" /><List t="الأكتر طلباً (من الطلبات الفعلية)" rows={det.o} u="قطعة" /></div>
        {det.o.length > 0 && <p className="card">💡 فكرة للصيدليات في {sel}: ركّزوا على {det.o.slice(0, 3).map((x) => x[0]).join('، ')}.</p>}
        <div className="card adm-tw"><h3 style={{ padding: '12px 14px 0' }}>الزوار والمستخدمون في {sel}</h3>
          <table className="adm-t"><thead><tr><th>الاسم</th><th>آخر ظهور</th><th>الموقع التقريبي</th></tr></thead>
            <tbody>{det.users.map((s) => <tr key={s.id}><td><b>{s.name}</b></td><td>{ago(s.t, now)}</td><td dir="ltr">{s.lat != null ? <a href={`https://www.google.com/maps?q=${s.lat},${s.lng}`} target="_blank" rel="noreferrer">{s.lat}, {s.lng}</a> : <span className="mu">محافظة فقط</span>}</td></tr>)}</tbody></table></div>
      </>}
    </>
  );
}

const TABS = [['overview', 'نظرة عامة', 'home'], ['live', 'مباشر', 'bolt'], ['users', 'المستخدمون', 'users'], ['areas', 'المناطق', 'pin'], ['pharmacies', 'الصيدليات', 'store'], ['products', 'المنتجات', 'pill'], ['banners', 'الإعلانات', 'star'], ['orders', 'الطلبات', 'bag'], ['rx', 'الروشتات', 'rx'], ['system', 'النظام', 'shield']];

export default function Admin() {
  const [tab, setTab] = useState('overview');
  const { user: me } = useAuth();
  const { pres, orders, users, phs, err, reload, setPhs, setUsers } = useData();
  const now = useNow(15000);
  const uById = useMemo(() => Object.fromEntries((users || []).map((u) => [u.id, u])), [users]);
  const sessions = useMemo(() => (pres || []).map((r) => { const u = r.uid ? uById[r.uid] : null; return { ...r, u, t: ms(r.lastSeen) ?? now, name: u?.name || (r.uid ? 'مستخدم' : 'زائر'), role: u?.role || null }; }).sort((a, b) => b.t - a.t), [pres, uById, now]);
  const online = sessions.filter((s) => now - s.t <= ON_MS);
  const recent = sessions.filter((s) => now - s.t > ON_MS && now - s.t <= RECENT_MS);
  const onlineIds = useMemo(() => new Set(online.filter((s) => s.uid).map((s) => s.uid)), [online]);

  if (err) return (
    <div className="card center"><h2>مش قادر أحمّل البيانات</h2>
      <p className="mu">{/permission/i.test(err) ? 'الحساب ده مش أدمن، أو قواعد Firestore الجديدة لسه ما اتنشرتش (firebase deploy --only firestore:rules).' : err}</p></div>
  );
  return (
    <div className="adm">
      <div className="row between wrap g adm-hd">
        <div><h1>لوحة التحكم</h1><p className="mu sm2">بيانات حية · آخر تحديث للحسابات والصيدليات يدوي بزر التحديث</p></div>
        <div className="row g"><span className="adm-live"><i />مباشر</span><button className="btn o sm" onClick={reload}>تحديث</button></div>
      </div>
      <div className="adm-tabs" role="tablist">{TABS.map(([k, l, ic]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}><Icon n={ic} s={16} />{l}{k === 'live' && <b>{online.length}</b>}</button>)}</div>
      {tab === 'overview' && <Overview sessions={sessions} online={online} users={users} phs={phs} orders={orders} now={now} />}
      {tab === 'live' && <Live sessions={sessions} online={online} recent={recent} now={now} />}
      {tab === 'users' && <Users users={users} setUsers={setUsers} sessions={sessions} now={now} onlineIds={onlineIds} meId={me?.uid} />}
      {tab === 'areas' && <AreasAdmin sessions={sessions} orders={orders} users={users} phs={phs} now={now} />}
      {tab === 'pharmacies' && <Pharmacies phs={phs} setPhs={setPhs} users={users} />}
      {tab === 'products' && <ProductsAdmin phs={phs} />}
      {tab === 'banners' && <BannersAdmin />}
      {tab === 'orders' && <Orders orders={orders} now={now} />}
      {tab === 'rx' && <RxAdmin now={now} />}
      {tab === 'system' && <System sessions={sessions} now={now} />}
    </div>
  );
}
