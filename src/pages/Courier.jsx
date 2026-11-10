import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, updateDoc, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useAuth } from '../auth.jsx';
import { km, fmtKm } from '../lib/geo.js';
import { ms } from '../lib/status.js';
import { useDriveRoute } from '../lib/route.js';
import TileMap, { useSmooth } from '../tilemap.jsx';
import { Icon } from '../icons.jsx';
import { toast } from '../ui.jsx';

const navUrl = (o) => o.dest
  ? `https://www.google.com/maps/dir/?api=1&destination=${o.dest.lat},${o.dest.lng}&travelmode=driving`
  : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(o.address);

// خريطة المندوب: موقعه ← موقع العميل بمسار حقيقي
function Nav({ o, me }) {
  const rt = useDriveRoute(me, o.dest), m = useSmooth(me);
  const markers = [{ id: 'dest', kind: 'dest', lat: o.dest.lat, lng: o.dest.lng, label: o.patientName }];
  if (m) markers.push({ id: 'me', kind: 'courier', lat: m.lat, lng: m.lng, label: 'إنت', heading: me && me.heading != null && me.speed > 1 ? me.heading : null, acc: me ? me.acc : 0 });
  const d = rt ? rt.km : me ? km(me, o.dest) * 1.3 : null;
  return (
    <div className="trk-map">
      <TileMap markers={markers} route={rt ? rt.pts : null} height={300} />
      {d != null && <div className="trk-chips"><span><Icon n="pin" s={16} /> {fmtKm(d)} للعميل</span>{rt && <span><Icon n="clock" s={16} /> حوالي {Math.max(1, Math.round(rt.min * 1.25))} دقيقة</span>}</div>}
      {!me && <p className="mu sm2 c">ابدأ مشاركة الموقع عشان نرسم لك الطريق.</p>}
    </div>
  );
}

// صفحة المندوب: طلباته + مشاركة موقعه لحظياً (بتشتغل والصفحة مفتوحة)
export default function Courier() {
  const { user, profile } = useAuth();
  const [rows, setRows] = useState(null), [share, setShare] = useState(false), [sent, setSent] = useState(null), [busy, setBusy] = useState(null), [me, setMe] = useState(null), [open, setOpen] = useState(null);
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
      setMe({ lat, lng, acc: Math.round(accuracy), speed: speed != null && !isNaN(speed) ? speed : 0, heading: heading != null && !isNaN(heading) ? heading : null });
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
  const on = share && !!ids;
  return (
    <div className="cur">
      <div className={'shbar' + (on ? ' on' : '')}>
        <div className="shi"><span className={'live' + (on ? '' : ' off')}><i></i>{on ? 'مشاركة الموقع شغّالة' : 'مشاركة الموقع متوقفة'}</span>
          <small>{sent ? 'آخر إرسال ' + new Date(sent.t).toLocaleTimeString('ar-EG') + ' · دقة ' + sent.acc + ' م' : 'سيب الصفحة مفتوحة والشاشة منوّرة'}</small></div>
        <button className={'sw' + (on ? ' on' : '')} role="switch" aria-checked={on} aria-label="مشاركة الموقع" disabled={!ids} onClick={() => setShare((v) => !v)}><i></i></button>
      </div>
      <h1>توصيلاتي <span className="mu sm2">· {profile.name}</span></h1>
      {rows && !active.length && <div className="card center empty"><Icon n="truck" s={44} /><h3>مفيش توصيلات دلوقتي</h3><p className="mu">أول ما الصيدلية تسلّمك طلب هيظهر هنا فوراً.</p></div>}
      {active.map((o) => (
        <div className="card dl" key={o.id}>
          <div className="row between wrap"><div><span className="bd am">في الطريق</span><h3>{o.patientName}</h3></div><b className="dist">{o.total} ج.م</b></div>
          <div className="kv"><span className="mu"><Icon n="pin" s={16} /></span><b>{o.address}</b></div>
          <div className="kv"><span className="mu"><Icon n="store" s={16} /></span><b>{o.pharmacyName}</b></div>
          {o.note && <div className="kv"><span className="mu"><Icon n="chat" s={16} /></span><b>{o.note}</b></div>}
          <ul className="items">{o.items.map((i, k) => <li key={k}>{i.name} {i.dose && '(' + i.dose + ')'} × {i.qty}</li>)}</ul>
          <p className="sm2 mu">الدفع عند الاستلام {!o.dest && <span className="err">· العميل ما حدّدش موقعه على الخريطة</span>}</p>
          {o.dest && <><button className="btn o sm" onClick={() => setOpen(open === o.id ? null : o.id)}><Icon n="pin" s={16} /> {open === o.id ? 'إخفاء الخريطة' : 'عرض الطريق'}</button>{open === o.id && <Nav o={o} me={me} />}</>}
          <div className="dl-act">
            <a className="btn" href={navUrl(o)} target="_blank" rel="noopener noreferrer"><Icon n="nav" s={18} /> افتح الملاحة</a>
            <a className="btn o" href={'tel:' + o.phone}><Icon n="phone" s={18} /> اتصل بالعميل</a>
            <button className="btn g" disabled={busy === o.id} onClick={() => deliver(o)}><Icon n="check" s={18} /> تم التسليم</button>
          </div>
        </div>
      ))}
      {rows && done > 0 && <p className="mu sm2 c">اتسلّم {done} طلب.</p>}
    </div>
  );
}
