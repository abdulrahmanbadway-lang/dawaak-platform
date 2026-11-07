import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, updateDoc, getDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useAuth } from '../auth.jsx';
import { GOV } from '../lib/gov.js';
import { getPos } from '../lib/geo.js';
import { LABEL, ms } from '../lib/status.js';
import { Field, Badge, toast } from '../ui.jsx';
import Products from './Products.jsx';
import { Steps } from './PatientOrders.jsx';

const NEXT = { new: [['preparing', 'قبول وتجهيز', ''], ['cancelled', 'رفض', 'o']], preparing: [['out', 'خرج للتوصيل', '']], out: [['done', 'تم التسليم', 'g']] };

function Orders({ uid }) {
  const [rows, setRows] = useState(null);
  useEffect(() => onSnapshot(query(collection(db, 'orders'), where('pharmacyId', '==', uid)),
    (s) => setRows(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => ms(b.createdAt) - ms(a.createdAt))),
    (e) => toast('تعذر تحميل الطلبات: ' + e.message)), [uid]);
  const move = async (o, st) => {
    try {
      if (st === 'preparing') // خصم الكميات من المخزون عند قبول الطلب
        for (const it of o.items) {
          const r = doc(db, 'products', it.productId), s = await getDoc(r);
          if (s.exists()) await updateDoc(r, { stock: Math.max(0, (s.data().stock || 0) - it.qty), updatedAt: serverTimestamp() });
        }
      await updateDoc(doc(db, 'orders', o.id), { status: st, updatedAt: serverTimestamp() });
    } catch (e) { toast('تعذر التحديث: ' + e.message); }
  };
  return (
    <div>
      {rows && !rows.length && <div className="card center"><p className="mu">مفيش طلبات لسه. أول ما مريض يطلب هيظهر هنا فوراً.</p></div>}
      {rows?.map((o) => (
        <div className="card" key={o.id}>
          <div className="row between wrap"><div><h3>{o.patientName} <Badge c={o.status === 'new' ? 'am' : o.status === 'cancelled' ? 'rd' : 'ok'}>{LABEL[o.status]}</Badge></h3>
            <p className="mu sm2" dir="ltr" style={{ textAlign: 'right' }}>{o.phone}</p><p className="mu sm2">{o.address}</p>{o.note && <p className="sm2">ملاحظة: {o.note}</p>}</div><b className="dist">{o.total} ج.م</b></div>
          <ul className="items">{o.items.map((i, k) => <li key={k}>{i.name} {i.dose && '(' + i.dose + ')'} × {i.qty}</li>)}</ul>
          <Steps status={o.status} />
          <div className="row g wrap">{(NEXT[o.status] || []).map(([st, l, c]) => <button key={st} className={'btn sm ' + c} onClick={() => move(o, st)}>{l}</button>)}</div>
        </div>
      ))}
    </div>
  );
}
function Profile({ uid }) {
  const [f, setF] = useState(null);
  useEffect(() => { getDoc(doc(db, 'pharmacies', uid)).then((s) => setF(s.data())); }, [uid]);
  if (!f) return <div className="center">جاري التحميل…</div>;
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
  const loc = async () => { try { const p = await getPos(); setF((s) => ({ ...s, lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6) })); toast('تم تحديد الموقع ✓'); } catch { toast('اسمح بالوصول للموقع'); } };
  const save = async (e) => {
    e.preventDefault();
    const lat = f.lat === '' || f.lat == null ? null : +f.lat, lng = f.lng === '' || f.lng == null ? null : +f.lng;
    if ((lat != null && (isNaN(lat) || Math.abs(lat) > 90)) || (lng != null && (isNaN(lng) || Math.abs(lng) > 180))) return toast('إحداثيات الموقع غير صحيحة');
    try {
      await updateDoc(doc(db, 'pharmacies', uid), { name: f.name, phone: f.phone, governorate: f.governorate, address: f.address, hours: f.hours || '', open: !!f.open, lat, lng });
      toast('تم حفظ بيانات الصيدلية ✓');
    } catch (x) { toast('تعذر الحفظ: ' + x.message); }
  };
  return (
    <form className="card narrow" onSubmit={save}>
      <p>{f.verified ? <Badge c="ok">صيدلية موثّقة</Badge> : <Badge c="am">قيد التوثيق · ترخيص {f.license}</Badge>}</p>
      <Field label="اسم الصيدلية" name="name" v={f.name} on={set('name')} />
      <Field label="رقم الموبايل" name="phone" v={f.phone} on={set('phone')} dir="ltr" />
      <Field label="المحافظة" name="governorate" type="select" options={GOV} v={f.governorate} on={set('governorate')} />
      <Field label="العنوان" name="address" v={f.address} on={set('address')} />
      <Field label="مواعيد العمل" name="hours" v={f.hours || ''} on={set('hours')} placeholder="مثلاً 9 ص – 12 م" />
      <div className="row g"><div style={{ flex: 1 }}><Field label="خط العرض (lat)" name="lat" v={f.lat ?? ''} on={set('lat')} dir="ltr" /></div><div style={{ flex: 1 }}><Field label="خط الطول (lng)" name="lng" v={f.lng ?? ''} on={set('lng')} dir="ltr" /></div></div>
      <button type="button" className="btn o sm" id="myloc" onClick={loc}>📍 استخدم موقعي الحالي</button>
      {f.lat == null && <p className="err">حدد موقع الصيدلية عشان تظهر للمرضى مرتبة بالأقرب.</p>}
      <Field label="الصيدلية مفتوحة الآن" name="open" type="checkbox" v={f.open} on={set('open')} />
      <button className="btn full">حفظ</button>
    </form>
  );
}
export default function PharmacyDash() {
  const { user, profile } = useAuth();
  const [tab, setTab] = useState('orders');
  return (
    <div>
      <h1>لوحة الصيدلية <span className="mu sm2">· {profile.name}</span></h1>
      <div className="tabs">{[['orders', 'الطلبات'], ['products', 'المنتجات'], ['profile', 'بيانات الصيدلية']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'orders' && <Orders uid={user.uid} />}
      {tab === 'products' && <Products uid={user.uid} />}
      {tab === 'profile' && <Profile uid={user.uid} />}
    </div>
  );
}
