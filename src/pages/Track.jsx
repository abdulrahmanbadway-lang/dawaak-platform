import { useEffect, useState } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.js';
import { km, fmtKm } from '../lib/geo.js';
import { ms, LABEL } from '../lib/status.js';
import { etaMin } from '../lib/map.js';
import TileMap from '../tilemap.jsx';
import { Steps } from './PatientOrders.jsx';
import { Badge } from '../ui.jsx';

// تتبع الطلب لحظياً (للمريض والصيدلية)
export default function Track({ id, role }) {
  const [o, setO] = useState(null), [tr, setTr] = useState(null), [ph, setPh] = useState(null), [err, setErr] = useState(''), [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(t); }, []);
  useEffect(() => onSnapshot(doc(db, 'orders', id), (s) => setO(s.exists() ? { id: s.id, ...s.data() } : false), (e) => setErr(e.message)), [id]);
  useEffect(() => onSnapshot(doc(db, 'tracking', id), (s) => setTr(s.exists() ? s.data() : null), () => setTr(null)), [id]);
  const pid = o ? o.pharmacyId : null;
  useEffect(() => { if (pid) getDoc(doc(db, 'pharmacies', pid)).then((s) => setPh(s.data() || null)).catch(() => {}); }, [pid]);

  const back = <a className="btn o sm" href={role === 'pharmacy' ? '#/pharmacy' : '#/orders'}>▸ رجوع</a>;
  if (err) return <div className="card center"><h3>مش قادر أفتح الطلب ده</h3><p className="mu sm2">{err}</p>{back}</div>;
  if (o === null) return <div className="center">جاري التحميل…</div>;
  if (o === false) return <div className="card center"><h3>الطلب مش موجود</h3>{back}</div>;

  const age = tr ? Math.max(0, Math.round((now - (ms(tr.updatedAt) || now)) / 1000)) : null;
  const stale = age != null && age > 90;
  const toDest = tr && o.dest ? km(tr, o.dest) : null;
  const pts = [];
  if (ph && ph.lat != null) pts.push({ lat: ph.lat, lng: ph.lng, emoji: '🏪', label: o.pharmacyName });
  if (o.dest) pts.push({ lat: o.dest.lat, lng: o.dest.lng, emoji: '🏠', label: role === 'pharmacy' ? 'العميل' : 'موقعك', cls: 'd' });
  if (tr) pts.push({ lat: tr.lat, lng: tr.lng, emoji: '🛵', label: o.courierName || 'المندوب', cls: 'c' });
  const ago = age == null ? '' : age < 10 ? 'الآن' : age < 60 ? 'من ' + age + ' ثانية' : 'من ' + Math.round(age / 60) + ' دقيقة';

  return (
    <div>
      <div className="row between wrap"><h1>تتبع الطلب</h1>{back}</div>
      <div className="card">
        <div className="row between wrap"><div><h3>{o.pharmacyName} <Badge c={o.status === 'cancelled' ? 'rd' : o.status === 'new' ? 'am' : 'ok'}>{LABEL[o.status]}</Badge></h3>
          <p className="mu sm2">{o.items.map((i) => i.name + ' × ' + i.qty).join(' · ')}</p></div><b className="dist">{o.total} ج.م</b></div>
        <Steps status={o.status} />

        {(o.status === 'new' || o.status === 'preparing') && <p className="mu">{o.status === 'new' ? 'الطلب وصل للصيدلية وبانتظار القبول.' : 'الصيدلية بتجهّز طلبك. هتقدر تتابع المندوب أول ما يخرج بيه.'}</p>}
        {o.status === 'done' && <p className="ok">تم تسليم الطلب ✓</p>}
        {o.status === 'cancelled' && <p className="err">الطلب اتلغى.</p>}

        {o.status === 'out' && (
          <>
            {!o.courierId && <p className="mu">الطلب خرج للتوصيل. الصيدلية بتوصّله بنفسها من غير تتبع مباشر.</p>}
            {o.courierId && (
              <>
                <div className="row between wrap g">
                  <span className={'live' + (tr && !stale ? '' : ' off')}><i></i>{!tr ? 'المندوب لسه ما بدأش يشارك موقعه' : stale ? 'آخر موقع ' + ago + ' (ممكن الاتصال ضعيف)' : 'مباشر · آخر تحديث ' + ago}</span>
                  {o.courierPhone && <a className="btn o sm" href={'tel:' + o.courierPhone}>📞 اتصل بالمندوب {o.courierName}</a>}
                </div>
                {tr && toDest != null && (
                  <div className="eta">
                    <div><span className="mu sm2">المسافة المتبقية</span><b>{fmtKm(toDest)}</b></div>
                    <div><span className="mu sm2">الوصول تقريباً (تقدير)</span><b>{toDest < 0.05 ? 'وصل تقريباً' : etaMin(toDest, tr.speed) + ' دقيقة'}</b></div>
                  </div>
                )}
                {tr && !o.dest && <p className="mu sm2">العميل ما حدّدش موقع التوصيل، فمش هنقدر نحسب المسافة.</p>}
                <TileMap points={pts} />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
