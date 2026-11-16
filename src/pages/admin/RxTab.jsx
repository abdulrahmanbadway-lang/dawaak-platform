import { useEffect, useState } from 'react';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { RX_LABEL, RX_TONE } from '../../lib/status.js';
import { Badge, toast } from '../../ui.jsx';
import { Empty, ago, dt, money, ms } from './common.jsx';
import { errMsg } from '../../lib/errors.js';

export default function RxAdmin({ now }) {
  const [rows, setRows] = useState(null), [st, setSt] = useState('');
  useEffect(() => {
    getDocs(query(collection(db, 'prescriptions'), orderBy('createdAt', 'desc'), limit(200)))
      .then((s) => setRows(s.docs.map((d) => ({ id: d.id, ...d.data() }))))
      .catch((e) => toast('تعذر تحميل الروشتات: ' + errMsg(e)));
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
