import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, getDocs, onSnapshot, query, orderBy, limit, updateDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase.js';
import { toast, Badge } from '../ui.jsx';
import { Icon } from '../icons.jsx';
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
  return { pres, orders, users, phs, err, reload: loadStatic, setPhs };
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

function Users({ users, sessions, now, onlineIds }) {
  const [q, setQ] = useState(''), [role, setRole] = useState('');
  const seen = useMemo(() => { const m = {}; sessions.forEach((s) => { if (s.uid) m[s.uid] = s; }); return m; }, [sessions]);
  const rows = (users || []).filter((u) => (!role || u.role === role) && (!q || [u.name, u.email].join(' ').toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => (ms(b.createdAt) || 0) - (ms(a.createdAt) || 0));
  const exp = () => download('dawaak-users.csv', csvText([['الاسم', 'البريد', 'الدور', 'تاريخ التسجيل', 'آخر ظهور', 'آخر IP', 'الجهاز'], ...rows.map((u) => { const s = seen[u.id]; return [u.name, u.email, ROLE[u.role] || u.role, dt(ms(u.createdAt)), s ? dt(s.t) : '', s?.ip || '', s?.dev || '']; })]));
  return (
    <>
      <div className="row g wrap adm-bar">
        <input className="fi adm-q" placeholder="ابحث بالاسم أو البريد…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="fi sel" value={role} onChange={(e) => setRole(e.target.value)}><option value="">كل الأدوار</option>{Object.entries(ROLE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <button className="btn o sm" onClick={exp}>تصدير CSV ({rows.length})</button>
      </div>
      <div className="card adm-tw">{!users ? <Empty>جاري التحميل…</Empty> : !rows.length ? <Empty>مفيش نتايج</Empty> :
        <table className="adm-t"><thead><tr><th></th><th>الاسم</th><th>البريد</th><th>الدور</th><th>سجّل</th><th>آخر ظهور</th><th>آخر IP</th><th>الجهاز</th></tr></thead>
          <tbody>{rows.map((u) => { const s = seen[u.id]; return (
            <tr key={u.id}><td><Dot on={onlineIds.has(u.id)} /></td><td><b>{u.name}</b></td><td dir="ltr" className="mu">{u.email}</td><td><Badge c={u.role === 'admin' ? 'am' : ''}>{ROLE[u.role] || u.role}</Badge></td>
              <td className="mu">{dt(ms(u.createdAt))}</td><td>{s ? ago(s.t, now) : <span className="mu">لسه ما دخلش بعد التحديث</span>}</td><td dir="ltr">{s?.ip || '—'}{s?.cc ? ' · ' + s.cc : ''}</td><td className="mu">{s?.dev || '—'}</td></tr>); })}</tbody></table>}</div>
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

const TABS = [['overview', 'نظرة عامة', 'home'], ['live', 'مباشر', 'bolt'], ['users', 'المستخدمون', 'users'], ['pharmacies', 'الصيدليات', 'store'], ['orders', 'الطلبات', 'bag'], ['system', 'النظام', 'shield']];

export default function Admin() {
  const [tab, setTab] = useState('overview');
  const { pres, orders, users, phs, err, reload, setPhs } = useData();
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
      {tab === 'users' && <Users users={users} sessions={sessions} now={now} onlineIds={onlineIds} />}
      {tab === 'pharmacies' && <Pharmacies phs={phs} setPhs={setPhs} users={users} />}
      {tab === 'orders' && <Orders orders={orders} now={now} />}
      {tab === 'system' && <System sessions={sessions} now={now} />}
    </div>
  );
}
