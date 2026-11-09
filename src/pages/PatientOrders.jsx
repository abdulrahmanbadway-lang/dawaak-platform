import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useAuth } from '../auth.jsx';
import { STEPS, LABEL, ms } from '../lib/status.js';
import { toast } from '../ui.jsx';

export function Steps({ status }) {
  if (status === 'cancelled') return <p className="err">تم إلغاء الطلب</p>;
  const cur = STEPS.findIndex((s) => s[0] === status);
  return <div className="steps">{STEPS.map(([k, l], i) => <div key={k}><i className={i <= cur ? 'on' : ''}></i><span className={i === cur ? 'cur' : ''}>{l}</span></div>)}</div>;
}
export default function PatientOrders() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);
  useEffect(() => onSnapshot(query(collection(db, 'orders'), where('patientId', '==', user.uid)),
    (s) => setRows(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => ms(b.createdAt) - ms(a.createdAt))),
    (e) => toast('تعذر تحميل الطلبات: ' + e.message)), [user.uid]);
  const cancel = async (id) => {
    if (!confirm('إلغاء الطلب؟')) return;
    try { await updateDoc(doc(db, 'orders', id), { status: 'cancelled', updatedAt: serverTimestamp() }); } catch (e) { toast('تعذر الإلغاء: ' + e.message); }
  };
  return (
    <div>
      <h1>طلباتي</h1>
      {rows && !rows.length && <div className="card center"><p className="mu">لسه معملتش أي طلب.</p><a className="btn" href="#/search">ابحث عن دوا</a></div>}
      {rows?.map((o) => (
        <div className="card" key={o.id}>
          <div className="row between wrap"><div><h3>{o.pharmacyName} {o.source === 'rx' && <span className="bd am">من روشتة</span>}</h3><p className="mu sm2">{ms(o.createdAt) ? new Date(ms(o.createdAt)).toLocaleString('ar-EG') : ''}</p></div><b className="dist">{o.total} ج.م</b></div>
          <ul className="items">{o.items.map((i, k) => <li key={k}>{i.name} {i.dose && '(' + i.dose + ')'} × {i.qty}</li>)}</ul>
          {o.courierName && o.status === 'out' && <p className="sm2">🛵 المندوب: {o.courierName}</p>}
          <Steps status={o.status} />
          <div className="row between wrap"><span className="mu sm2">{LABEL[o.status]} · الدفع عند الاستلام</span>
            {o.status === 'out' && <a className="btn g sm" href={'#/track/' + o.id}>🛵 تتبع الطلب</a>}
            {o.status === 'new' && <button className="btn o sm" onClick={() => cancel(o.id)}>إلغاء الطلب</button>}</div>
        </div>
      ))}
    </div>
  );
}
