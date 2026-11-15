import { useState } from 'react';
import { Badge } from '../../ui.jsx';
import { Empty, ST, ST_C, ago, csvText, download, dt, money, ms } from './common.jsx';

export default function Orders({ orders, now }) {
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
