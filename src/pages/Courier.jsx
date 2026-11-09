import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, updateDoc, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useAuth } from '../auth.jsx';
import { km } from '../lib/geo.js';
import { ms } from '../lib/status.js';
import { Badge, toast } from '../ui.jsx';

const navUrl = (o) => o.dest
  ? `https://www.google.com/maps/dir/?api=1&destination=${o.dest.lat},${o.dest.lng}&travelmode=driving`
  : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(o.address);

// صفحة المندوب: طلباته + مشاركة موقعه لحظياً (بتشتغل والصفحة مفتوحة)
export default function Courier() {
  const { user, profile } = useAuth();
  const [rows, setRows] = useState(null), [share, setShare] = useState(false), [sent, setSent] = useState(null), [busy, setBusy] = useState(null);
  useEffect(() => onSnapshot(query(collection(db, 'orders'), where('courierId', '==', user.uid)),
    (s) => setRows(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => ms(b.updatedAt) - ms(a.updatedAt))),
    (e) => toast('تعذر تحميل التوصيلات: ' + e.message)), [user.uid]);
  const active = (rows || []).filter((o) => o.status === 'out');
  const ids = active.map((o) => o.id).join(',');

  useEffect(() => {
    if (!share || !ids) return;
    if (!navigator.geolocation) { toast('المتصفح ده مش بيدعم تحديد الموقع'); setShare(false); return; }
    const list = ids.split(',');
    let last = { t: 0, lat: null, lng: null }, wl = null, stop = false;
    if (navigator.wakeLock) navigator.wakeLock.request('screen').then((l) => { wl = l; if (stop) l.release(); }).catch(() => {});
    const wid = navigator.geolocation.watchPosition(async (p) => {
      const { latitude: lat, longitude: lng, accuracy, speed, heading } = p.coords, now = Date.now();
      const moved = last.lat == null ? 1e9 : km({ lat, lng }, last) * 1000;
      // بنبعت لما يتحرك 8 متر (بحد أدنى 5 ثواني) أو كل 20 ثانية على الأكتر، عشان نوفّر الكتابة
      if (!((now - last.t >= 5000 && moved >= 8) || now - last.t >= 20000)) return;
      last = { t: now, lat, lng };
      try {
        const b = writeBatch(db);
        list.forEach((oid) => b.set(doc(db, 'tracking', oid), {
          courierId: user.uid, lat: +lat.toFixed(6), lng: +lng.toFixed(6), acc: Math.round(accuracy),
          ...(speed != null && !isNaN(speed) ? { speed: +speed.toFixed(1) } : {}),
          ...(heading != null && !isNaN(heading) ? { heading: Math.round(heading) } : {}),
          updatedAt: serverTimestamp(),
        }));
        await b.commit(); setSent({ t: now, acc: Math.round(accuracy) });
      } catch (x) { toast('تعذر إرسال الموقع: ' + x.message); }
    }, (er) => { toast(er.code === 1 ? 'اسمح بالوصول للموقع من إعدادات المتصفح' : 'تعذر قراءة الموقع'); setShare(false); },
    { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 });
    return () => { stop = true; navigator.geolocation.clearWatch(wid); if (wl) wl.release(); };
  }, [share, ids, user.uid]);

  const deliver = async (o) => {
    if (!confirm('تأكيد تسليم الطلب لـ ' + o.patientName + '؟')) return;
    setBusy(o.id);
    try { await updateDoc(doc(db, 'orders', o.id), { status: 'done', updatedAt: serverTimestamp() }); toast('تم التسليم ✓'); } catch (x) { toast('تعذر التحديث: ' + x.message); }
    setBusy(null);
  };
  const done = (rows || []).filter((o) => o.status === 'done').length;
  return (
    <div>
      <h1>توصيلاتي <span className="mu sm2">· {profile.name}</span></h1>
      <div className="card">
        <div className="row between wrap g">
          <div><span className={'live' + (share && ids ? '' : ' off')}><i></i>{share && ids ? 'مشاركة الموقع شغّالة' : 'مشاركة الموقع متوقفة'}</span>
            <p className="mu sm2">{sent ? 'آخر إرسال ' + new Date(sent.t).toLocaleTimeString('ar-EG') + ' · دقة ' + sent.acc + ' م' : 'سيب الصفحة مفتوحة والشاشة منوّرة عشان الموقع يفضل يتبعت.'}</p></div>
          <button className={'btn ' + (share ? 'o' : 'g')} disabled={!ids} onClick={() => setShare((v) => !v)}>{share ? '⏸ إيقاف المشاركة' : '▶ ابدأ مشاركة موقعي'}</button>
        </div>
        {!ids && <p className="mu sm2">مفيش توصيلات شغّالة دلوقتي. أول ما الصيدلية تسلّمك طلب هيظهر هنا.</p>}
      </div>
      {active.map((o) => (
        <div className="card" key={o.id}>
          <div className="row between wrap"><div><h3>{o.patientName} <Badge c="am">في الطريق</Badge></h3>
            <p className="mu sm2" dir="ltr" style={{ textAlign: 'right' }}>{o.phone}</p><p className="mu sm2">{o.address}</p>{o.note && <p className="sm2">ملاحظة: {o.note}</p>}</div>
            <b className="dist">{o.total} ج.م</b></div>
          <ul className="items">{o.items.map((i, k) => <li key={k}>{i.name} {i.dose && '(' + i.dose + ')'} × {i.qty}</li>)}</ul>
          <p className="sm2">من: {o.pharmacyName} · الدفع عند الاستلام {!o.dest && <span className="err">· العميل ما حدّدش موقعه على الخريطة</span>}</p>
          <div className="row g wrap">
            <a className="btn sm" href={navUrl(o)} target="_blank" rel="noopener noreferrer">🧭 افتح الملاحة</a>
            <a className="btn o sm" href={'tel:' + o.phone}>📞 اتصل بالعميل</a>
            <button className="btn g sm" disabled={busy === o.id} onClick={() => deliver(o)}>✔ تم التسليم</button>
          </div>
        </div>
      ))}
      {rows && done > 0 && <p className="mu sm2 c">اتسلّم {done} طلب.</p>}
    </div>
  );
}
