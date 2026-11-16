import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useAuth } from '../auth.jsx';
import { STEPS, LABEL, ms } from '../lib/status.js';
import { toast } from '../ui.jsx';
import { Icon } from '../icons.jsx';
import { ErrorState } from '../skeleton.jsx';
import { trs, lcl, tdata } from '../lib/i18n.js';
import { errMsg } from '../lib/errors.js';

const STEP_IC = { new: 'bag', preparing: 'pill', out: 'truck', done: 'check' };
export function Steps({ status }) {
  if (status === 'cancelled') return <p className="stp-x"><Icon n="x" s={16} /> {trs("تم إلغاء الطلب")}</p>;
  const cur = STEPS.findIndex((s) => s[0] === status);
  return (
    <ol className="stp" aria-label={trs("مراحل الطلب")}>
      {STEPS.map(([k, l], i) => <li key={k} className={i < cur ? 'done' : i === cur ? 'cur' : ''}><i><Icon n={i < cur ? 'check' : STEP_IC[k]} s={16} /></i><span>{trs(l)}</span></li>)}
    </ol>
  );
}
export default function PatientOrders() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null), [err, setErr] = useState(null), [tick, setTick] = useState(0);
  useEffect(() => onSnapshot(query(collection(db, 'orders'), where('patientId', '==', user.uid)),
    (s) => { setErr(null); setRows(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => ms(b.createdAt) - ms(a.createdAt))); },
    (e) => setErr(e)), [user.uid, tick]);
  const cancel = async (id) => {
    if (!confirm(trs("إلغاء الطلب؟"))) return;
    try { await updateDoc(doc(db, 'orders', id), { status: 'cancelled', updatedAt: serverTimestamp() }); toast(trs("تم إلغاء الطلب")); } catch (e) { toast(trs("تعذر الإلغاء: ") + errMsg(e)); }
  };
  return (
    <div>
      <h1>{trs("طلباتي")}</h1>
      {err && !rows && <ErrorState error={err} onRetry={() => { setErr(null); setTick((t) => t + 1); }} />}
      {!rows && !err && [0, 1, 2].map((i) => <div className="card" key={i} role="status" aria-busy="true"><div className="sk" style={{ height: 18, width: '40%' }} /><div className="sk" style={{ height: 14, width: '70%', marginTop: 12 }} /><div className="sk" style={{ height: 38, marginTop: 14 }} /></div>)}
      {rows && !rows.length && <div className="card center"><p className="mu">{trs("لسه معملتش أي طلب.")}</p><a className="btn" href="#/search">{trs("ابحث عن دوا")}</a></div>}
      {rows?.map((o) => (
        <div className="card" key={o.id}>
          <div className="row between wrap"><div><h3>{o.pharmacyName} {o.source === 'rx' && <span className="bd am">{trs("من روشتة")}</span>}</h3><p className="mu sm2">{ms(o.createdAt) ? new Date(ms(o.createdAt)).toLocaleString(lcl()) : ''}</p></div><b className="dist">{o.total} {trs("ج.م")}</b></div>
          <ul className="items">{o.items.map((i, k) => <li key={k}>{i.name} {i.dose && '(' + tdata(i.dose) + ')'} × {i.qty}</li>)}</ul>
          {o.courierName && o.status === 'out' && <p className="sm2">{trs("المندوب:")}{" "}{o.courierName}</p>}
          <Steps status={o.status} />
          <div className="row between wrap"><span className="mu sm2">{trs(LABEL[o.status])} {trs("· الدفع عند الاستلام")}</span>
            {o.status === 'out' && <a className="btn g sm" href={'#/track/' + o.id}><Icon n="truck" s={16} /> {trs("تتبع الطلب")}</a>}
            {(o.status === 'new' || o.status === 'preparing' || o.status === 'done') && <a className="btn o sm" href={'#/track/' + o.id}>{trs("تفاصيل الطلب")}</a>}
            {o.status === 'new' && <button className="btn o sm" onClick={() => cancel(o.id)}>{trs("إلغاء الطلب")}</button>}</div>
        </div>
      ))}
    </div>
  );
}
