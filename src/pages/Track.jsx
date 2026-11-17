import { useEffect, useMemo, useRef, useState } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.js';
import { km, fmtKm } from '../lib/geo.js';
import { signalState, isNear, mapsUrl } from '../lib/delivery.js';
import { ms, LABEL } from '../lib/status.js';
import { etaMin } from '../lib/map.js';
import { useDriveRoute } from '../lib/route.js';
import TileMap, { useSmooth } from '../tilemap.jsx';
import { Icon } from '../icons.jsx';
import { Steps } from './PatientOrders.jsx';
import { trs, tdata, lcl } from '../lib/i18n.js';
import { errMsg } from '../lib/errors.js';

const HEAD = {
  new: ['تم استلام طلبك', 'بانتظار قبول الصيدلية'],
  preparing: ['الصيدلية بتجهّز طلبك', 'هتقدر تتابع المندوب أول ما يخرج بيه'],
  done: ['تم تسليم الطلب', 'نتمنى لك الشفاء العاجل'],
  cancelled: ['الطلب اتلغى', ''],
};
const agoTxt = (age) => {
  if (age < 10) return trs("الآن");
  if (age < 60) return trs("منذ {0} ثانية", [age]);
  const m = Math.round(age / 60);
  return m < 60 ? (m >= 3 && m <= 10 ? trs("منذ {0} دقائق", [m]) : trs("منذ {0} دقيقة", [m])) : trs("منذ {0} ساعة", [Math.round(m / 60)]);
};

// تتبع الطلب لحظياً (للمريض والصيدلية): الحالة والرسالة الواضحة أولاً، وبعدها الخريطة وبيانات المندوب والطلب
export default function Track({ id, role }) {
  const [o, setO] = useState(null), [tr, setTr] = useState(null), [ph, setPh] = useState(null), [err, setErr] = useState(null), [now, setNow] = useState(Date.now());
  const [trail, setTrail] = useState([]), lastT = useRef(null);
  useEffect(() => onSnapshot(doc(db, 'orders', id), (s) => setO(s.exists() ? { id: s.id, ...s.data() } : false), (e) => setErr(e)), [id]);
  // موقع المندوب بنقراه بس وهو فعلاً في الطريق (مفيش قراءات زيادة في باقي الحالات)
  const live_ = !!(o && o.status === 'out' && o.courierId);
  useEffect(() => {
    if (!live_) { setTr(null); return undefined; }
    const t = setInterval(() => setNow(Date.now()), 10000); setNow(Date.now());
    const u = onSnapshot(doc(db, 'tracking', id), (s) => setTr(s.exists() ? s.data() : null), () => setTr(null));
    return () => { clearInterval(t); u(); };
  }, [id, live_]);
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

  // العلامات متتحسبش من جديد مع كل تحديث للساعة، فالخريطة (memo) ما بتتعيدش رسمها من غير داعي
  const dest = o ? o.dest : null, phName = o ? o.pharmacyName : '', cName = o ? o.courierName : '';
  const markers = useMemo(() => {
    const m = [];
    if (ph && ph.lat != null) m.push({ id: 'ph', kind: 'pharmacy', lat: ph.lat, lng: ph.lng, label: phName });
    if (dest) m.push({ id: 'dest', kind: 'dest', lat: dest.lat, lng: dest.lng, label: role === 'pharmacy' ? trs("العميل") : trs("موقعك") });
    if (cour) m.push({ id: 'c', kind: 'courier', lat: cour.lat, lng: cour.lng, label: cName || trs("المندوب"), heading: tr && tr.speed > 1 && tr.heading != null ? tr.heading : null, acc: tr ? tr.acc : 0 });
    return m;
  }, [ph, phName, dest, cName, cour, tr, role]);

  const back = <a className="back" href={role === 'pharmacy' ? '#/pharmacy' : '#/orders'}><Icon n="back" s={18} /> {trs("رجوع")}</a>;
  if (err) return <div className="card center"><h3>{trs("مش قادر أفتح الطلب ده")}</h3><p className="mu sm2">{errMsg(err)}</p>{back}</div>;
  if (o === null) return <div className="trk" role="status" aria-busy="true"><div className="card"><div className="sk" style={{ height: 22, width: '55%' }} /><div className="sk" style={{ height: 14, width: '80%', marginTop: 12 }} /><div className="sk" style={{ height: 60, marginTop: 16 }} /></div><div className="sk" style={{ height: 260, borderRadius: 20 }} /></div>;
  if (o === false) return <div className="card center"><h3>{trs("الطلب مش موجود")}</h3>{back}</div>;

  const out = o.status === 'out', withCour = out && !!o.courierId;
  const { state: sg, age } = signalState(tr, now);
  const live = sg === 'live';
  const near = live && isNear(tr, o.dest);
  const straight = tr && o.dest ? km(tr, o.dest) : null;
  const distKm = rt ? rt.km : straight != null ? straight * 1.3 : null;
  const etaM = rt ? Math.max(1, Math.round(rt.min * 1.25)) : straight != null ? etaMin(straight, tr.speed) : null;
  const who = role === 'pharmacy' ? trs("للعميل") : trs("إليك");

  // رسالة الحالة الرئيسية + نبرتها (ok / warn / err / info)
  let title, sub = '', tone = 'info';
  if (withCour) {
    if (sg === 'none') { title = trs("بانتظار مشاركة المندوب لموقعه"); sub = trs("المندوب لسه ما فتحش المشاركة. لو اتأخر كلّمه من الزرار تحت."); tone = 'warn'; }
    else if (sg === 'lost') { title = trs("انقطعت إشارة المندوب"); sub = (role === 'pharmacy' ? trs("ممكن يكون وقّف المشاركة. كلّمه وتأكد إنه فاتح الصفحة.") : trs("ممكن يكون وقّف المشاركة أو الشبكة ضعيفة. لو اتأخر كلّمه.")); tone = 'err'; }
    else if (sg === 'weak') { title = trs("الإشارة ضعيفة"); sub = trs("ممكن يكون في منطقة شبكتها ضعيفة."); tone = 'warn'; }
    else if (near) { title = role === 'pharmacy' ? trs("المندوب قريب من العميل") : trs("المندوب قريب منك"); sub = role === 'pharmacy' ? '' : trs("جهّز نفسك للاستلام والدفع عند الاستلام."); tone = 'ok'; }
    else { title = trs("المندوب في الطريق ") + who; tone = 'ok'; }
  } else if (out) { title = trs("طلبك خرج للتوصيل"); sub = trs("الصيدلية بتوصّله بنفسها من غير تتبع مباشر"); }
  else [title, sub] = (HEAD[o.status] || ['', '']).map((x) => (x ? trs(x) : x));
  if (o.status === 'done') tone = 'ok'; else if (o.status === 'cancelled') tone = 'err';
  const doneAt = o.status === 'done' && ms(o.updatedAt) ? new Date(ms(o.updatedAt)).toLocaleString(lcl()) : '';

  // مفيش خريطة فاضية: الخريطة بتظهر بس لو فيه موقع نعرضه (المندوب أو العميل)
  const showMap = withCour && (tr || o.dest);

  return (
    <div className="trk">
      <div className="row between wrap trk-top">{back}<span className="mu sm2">{trs("طلب رقم")}{" "}{o.id.slice(-5).toUpperCase()}</span></div>

      <section className={'card trk-hero tone-' + tone}>
        <div className="trk-ttl">
          {withCour && <span className={'live' + (live ? '' : ' off')}><i></i>{sg === 'none' ? trs("بانتظار الإشارة") : live ? trs("مباشر · ") + agoTxt(age) : trs("آخر موقع ") + agoTxt(age)}</span>}
          <h2>{title}</h2>
          {sub && <p className="mu">{sub}</p>}
          {doneAt && <p className="mu sm2">{doneAt}</p>}
        </div>
        {withCour && etaM != null && live && !near && <div className="trk-eta"><b>{etaM}</b><span>{trs("دقيقة")}</span></div>}
        {near && <div className="trk-eta ok"><Icon n="check" s={26} /><span>{trs("وصل تقريباً")}</span></div>}
        <Steps status={o.status} />
      </section>

      {withCour && !o.dest && (
        <section className="card trk-addr">
          <div className="row between wrap g"><div><b>{trs("عنوان التوصيل")}</b><p className="mu">{o.address}</p><p className="mu sm2">{trs("العميل ما حدّدش موقعه على الخريطة، فمش هنقدر نحسب المسافة والوقت.")}</p></div>
            <a className="btn o" href={mapsUrl(o)} target="_blank" rel="noopener noreferrer"><Icon n="pin" s={18} /> {trs("افتح في الخرائط")}</a></div>
        </section>
      )}

      {showMap && (
        <section className="trk-map">
          <TileMap markers={markers} route={rt ? rt.pts : null} trail={trail} height={380} />
          {distKm != null && tr && (
            <div className="trk-chips">
              <span><Icon n="pin" s={16} /> {fmtKm(distKm)} {trs("متبقية")}</span>
              <span><Icon n="clock" s={16} /> {live ? (rt ? trs("حسب المسار") : trs("تقدير بالمسافة")) : trs("آخر موقع معروف")}</span>
            </div>
          )}
        </section>
      )}

      {withCour && (
        <section className="card crd">
          <div className="avatar">{(o.courierName || trs("م"))[0]}</div>
          <div className="crd-i"><b>{o.courierName}</b><span className="mu sm2">{trs("مندوب التوصيل ·")}{" "}{o.pharmacyName}</span></div>
          {o.courierPhone && <a className={'btn ' + (sg === 'live' ? 'o' : 'g')} href={'tel:' + o.courierPhone}><Icon n="phone" s={18} /> {trs("اتصل")}</a>}
        </section>
      )}

      <section className="card">
        <div className="row between wrap"><h3>{trs("تفاصيل الطلب")}</h3><span className={'bd ' + (o.status === 'cancelled' ? 'rd' : o.status === 'new' ? 'am' : 'ok')}>{trs(LABEL[o.status])}</span></div>
        <ul className="items">{o.items.map((i, k) => <li key={k}>{i.name} {i.dose && '(' + tdata(i.dose) + ')'} × {i.qty}</li>)}</ul>
        <div className="kv"><span className="mu">{trs("الصيدلية")}</span><b>{o.pharmacyName}</b></div>
        <div className="kv"><span className="mu">{trs("العنوان")}</span><b>{o.address}</b></div>
        <div className="kv"><span className="mu">{trs("الدفع")}</span><b>{trs("عند الاستلام")}</b></div>
        <div className="kv tot"><span>{trs("الإجمالي")}</span><b>{o.total} {trs("ج.م")}</b></div>
      </section>
    </div>
  );
}
