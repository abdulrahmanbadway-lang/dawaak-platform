import { useEffect, useRef, useState } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.js';
import { km, fmtKm } from '../lib/geo.js';
import { ms, LABEL } from '../lib/status.js';
import { etaMin } from '../lib/map.js';
import { useDriveRoute } from '../lib/route.js';
import TileMap, { useSmooth } from '../tilemap.jsx';
import { Icon } from '../icons.jsx';
import { Steps } from './PatientOrders.jsx';

const HEAD = {
  new: ['تم استلام طلبك', 'بانتظار قبول الصيدلية'],
  preparing: ['الصيدلية بتجهّز طلبك', 'هتقدر تتابع المندوب أول ما يخرج بيه'],
  done: ['تم تسليم الطلب', 'نتمنى لك الشفاء العاجل'],
  cancelled: ['الطلب اتلغى', ''],
};

// تتبع الطلب لحظياً (للمريض والصيدلية): الخريطة أولاً، وتحتها بيانات المندوب والطلب
export default function Track({ id, role }) {
  const [o, setO] = useState(null), [tr, setTr] = useState(null), [ph, setPh] = useState(null), [err, setErr] = useState(''), [now, setNow] = useState(Date.now());
  const [trail, setTrail] = useState([]), lastT = useRef(null);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(t); }, []);
  useEffect(() => onSnapshot(doc(db, 'orders', id), (s) => setO(s.exists() ? { id: s.id, ...s.data() } : false), (e) => setErr(e.message)), [id]);
  useEffect(() => onSnapshot(doc(db, 'tracking', id), (s) => setTr(s.exists() ? s.data() : null), () => setTr(null)), [id]);
  const pid = o ? o.pharmacyId : null;
  useEffect(() => { if (pid) getDoc(doc(db, 'pharmacies', pid)).then((s) => setPh(s.data() || null)).catch(() => {}); }, [pid]);
  // أثر الحركة اللي المندوب عدّى عليه (من وقت فتح الصفحة)
  useEffect(() => {
    if (!tr) return;
    const k = tr.lat + ',' + tr.lng;
    if (lastT.current !== k) { lastT.current = k; setTrail((a) => [...a.slice(-80), [tr.lat, tr.lng]]); }
  }, [tr]);
  const cour = useSmooth(tr ? { lat: tr.lat, lng: tr.lng } : null);
  const rt = useDriveRoute(tr && o && o.dest ? tr : null, o ? o.dest : null);

  const back = <a className="back" href={role === 'pharmacy' ? '#/pharmacy' : '#/orders'}><Icon n="back" s={18} /> رجوع</a>;
  if (err) return <div className="card center"><h3>مش قادر أفتح الطلب ده</h3><p className="mu sm2">{err}</p>{back}</div>;
  if (o === null) return <div className="center">جاري التحميل…</div>;
  if (o === false) return <div className="card center"><h3>الطلب مش موجود</h3>{back}</div>;

  const age = tr ? Math.max(0, Math.round((now - (ms(tr.updatedAt) || now)) / 1000)) : null;
  const stale = age != null && age > 90;
  const live = !!tr && !stale;
  const straight = tr && o.dest ? km(tr, o.dest) : null;
  const distKm = rt ? rt.km : straight != null ? straight * 1.3 : null;
  const etaM = rt ? Math.max(1, Math.round(rt.min * 1.25)) : straight != null ? etaMin(straight, tr.speed) : null;
  const ago = age == null ? '' : age < 10 ? 'الآن' : age < 60 ? 'من ' + age + ' ثانية' : 'من ' + Math.round(age / 60) + ' دقيقة';

  const markers = [];
  if (ph && ph.lat != null) markers.push({ id: 'ph', kind: 'pharmacy', lat: ph.lat, lng: ph.lng, label: o.pharmacyName });
  if (o.dest) markers.push({ id: 'dest', kind: 'dest', lat: o.dest.lat, lng: o.dest.lng, label: role === 'pharmacy' ? 'العميل' : 'موقعك' });
  if (cour) markers.push({ id: 'c', kind: 'courier', lat: cour.lat, lng: cour.lng, label: o.courierName || 'المندوب', heading: tr && tr.speed > 1 && tr.heading != null ? tr.heading : null, acc: tr ? tr.acc : 0 });

  const out = o.status === 'out';
  const [title, sub] = out ? [o.courierId ? (live ? 'المندوب في الطريق ' + (role === 'pharmacy' ? 'للعميل' : 'إليك') : tr ? 'مش بنستقبل موقع المندوب دلوقتي' : 'بانتظار مشاركة المندوب لموقعه') : 'طلبك خرج للتوصيل', o.courierId ? '' : 'الصيدلية بتوصّله بنفسها من غير تتبع مباشر'] : HEAD[o.status] || ['', ''];
  const showMap = out && o.courierId;

  return (
    <div className="trk">
      <div className="row between wrap trk-top">{back}<span className="mu sm2">طلب رقم {o.id.slice(-5).toUpperCase()}</span></div>

      <section className="card trk-hero">
        <div className="trk-ttl">
          {out && o.courierId && <span className={'live' + (live ? '' : ' off')}><i></i>{!tr ? 'بانتظار الإشارة' : stale ? 'آخر موقع ' + ago : 'مباشر · ' + ago}</span>}
          <h2>{title}</h2>
          {sub && <p className="mu">{sub}</p>}
        </div>
        {out && etaM != null && live && <div className="trk-eta"><b>{straight < 0.05 ? '٠' : etaM}</b><span>{straight < 0.05 ? 'وصل تقريباً' : 'دقيقة'}</span></div>}
        <Steps status={o.status} />
      </section>

      {showMap && (
        <section className="trk-map">
          <TileMap markers={markers} route={rt ? rt.pts : null} trail={trail} height={420} />
          {distKm != null && live && (
            <div className="trk-chips">
              <span><Icon n="pin" s={16} /> {fmtKm(distKm)} متبقية</span>
              <span><Icon n="clock" s={16} /> {rt ? 'حسب المسار' : 'تقدير بالمسافة'}</span>
            </div>
          )}
          {tr && !o.dest && <p className="mu sm2 c">العميل ما حدّدش موقع التوصيل، فمش هنقدر نحسب المسافة.</p>}
        </section>
      )}

      {out && o.courierId && (
        <section className="card crd">
          <div className="avatar">{(o.courierName || 'م')[0]}</div>
          <div className="crd-i"><b>{o.courierName}</b><span className="mu sm2">مندوب التوصيل · {o.pharmacyName}</span></div>
          {o.courierPhone && <a className="btn g" href={'tel:' + o.courierPhone}><Icon n="phone" s={18} /> اتصل</a>}
        </section>
      )}

      <section className="card">
        <div className="row between wrap"><h3>تفاصيل الطلب</h3><span className={'bd ' + (o.status === 'cancelled' ? 'rd' : o.status === 'new' ? 'am' : 'ok')}>{LABEL[o.status]}</span></div>
        <ul className="items">{o.items.map((i, k) => <li key={k}>{i.name} {i.dose && '(' + i.dose + ')'} × {i.qty}</li>)}</ul>
        <div className="kv"><span className="mu">الصيدلية</span><b>{o.pharmacyName}</b></div>
        <div className="kv"><span className="mu">العنوان</span><b>{o.address}</b></div>
        <div className="kv"><span className="mu">الدفع</span><b>عند الاستلام</b></div>
        <div className="kv tot"><span>الإجمالي</span><b>{o.total} ج.م</b></div>
      </section>
    </div>
  );
}
