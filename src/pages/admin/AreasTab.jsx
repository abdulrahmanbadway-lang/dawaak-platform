import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { nearestGov } from '../../lib/egypt.js';
import { Empty, Kpi, ago, topN } from './common.jsx';
import { errMsg } from '../../lib/errors.js';

export default function AreasAdmin({ sessions, orders, users, phs, now }) {
  const [dem, setDem] = useState(null), [sel, setSel] = useState(''), [err, setErr] = useState('');
  useEffect(() => {
    getDocs(query(collection(db, 'demand'), limit(600))).then((s) => setDem(s.docs.map((d) => ({ id: d.id, ...d.data() })))).catch((e) => setErr(errMsg(e)));
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
