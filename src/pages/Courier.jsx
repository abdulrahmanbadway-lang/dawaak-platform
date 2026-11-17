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
import { trs, lcl, tdata } from '../lib/i18n.js';
import { errMsg } from '../lib/errors.js';
import { mapsUrl } from '../lib/delivery.js';

// خريطة المندوب: موقعه ← موقع العميل بمسار حقيقي
function Nav({ o, me }) {
  const rt = useDriveRoute(me, o.dest), m = useSmooth(me);
  const markers = [{ id: 'dest', kind: 'dest', lat: o.dest.lat, lng: o.dest.lng, label: o.patientName }];
  if (m) markers.push({ id: 'me', kind: 'courier', lat: m.lat, lng: m.lng, label: trs("إنت"), heading: me && me.heading != null && me.speed > 1 ? me.heading : null, acc: me ? me.acc : 0 });
  const d = rt ? rt.km : me ? km(me, o.dest) * 1.3 : null;
  return (
    <div className="trk-map">
      <TileMap markers={markers} route={rt ? rt.pts : null} height={300} />
      {d != null && <div className="trk-chips"><span><Icon n="pin" s={16} /> {fmtKm(d)} {trs("للعميل")}</span>{rt && <span><Icon n="clock" s={16} /> {trs("حوالي")}{" "}{Math.max(1, Math.round(rt.min * 1.25))} {trs("دقيقة")}</span>}</div>}
      {!me && <p className="mu sm2 c">{trs("ابدأ مشاركة الموقع عشان نرسم لك الطريق.")}</p>}
    </div>
  );
}

// صفحة المندوب: بسيطة جدًا وقت التوصيل. فوق: زرار المشاركة الكبير + حالتها (ON/OFF). تحته: الطلبات الحالية.
export default function Courier() {
  const { user, profile } = useAuth();
  const [rows, setRows] = useState(null), [share, setShare] = useState(false), [sent, setSent] = useState(null), [busy, setBusy] = useState(null), [me, setMe] = useState(null), [open, setOpen] = useState(null);
  const [ask, setAsk] = useState(null), [sendErr, setSendErr] = useState(''), [gps, setGps] = useState('ok'), [loadErr, setLoadErr] = useState('');
  useEffect(() => onSnapshot(query(collection(db, 'orders'), where('courierId', '==', user.uid)),
    (s) => { setLoadErr(''); setRows(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => ms(b.updatedAt) - ms(a.updatedAt))); },
    (e) => setLoadErr(errMsg(e))), [user.uid]);
  const active = (rows || []).filter((o) => o.status === 'out');
  const ids = active.map((o) => o.id).join(',');
  // خلص التوصيلات = وقّف المشاركة (خصوصية المندوب)، ولما يجيله طلب جديد يبدأها بنفسه
  useEffect(() => { if (!ids) { setShare(false); setSendErr(''); } }, [ids]);

  useEffect(() => {
    if (!share || !ids) return undefined;
    if (!navigator.geolocation) { toast(trs("المتصفح ده مش بيدعم تحديد الموقع")); setShare(false); return undefined; }
    const list = ids.split(',');
    let last = { t: 0, lat: null, lng: null }, pos = null, wl = null, stop = false;
    if (navigator.wakeLock) navigator.wakeLock.request('screen').then((l) => { wl = l; if (stop) l.release(); }).catch(() => {});
    const push = async (p, now) => {
      last = { t: now, lat: p.lat, lng: p.lng };
      try {
        const b = writeBatch(db);
        list.forEach((oid) => b.set(doc(db, 'tracking', oid), {
          courierId: user.uid, lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6), acc: p.acc,
          ...(p.speed != null ? { speed: +p.speed.toFixed(1) } : {}),
          ...(p.heading != null ? { heading: Math.round(p.heading) } : {}),
          updatedAt: serverTimestamp(),
        }));
        await b.commit(); setSent({ t: now, acc: p.acc }); setSendErr('');
      } catch (x) { setSendErr(errMsg(x)); }
    };
    const wid = navigator.geolocation.watchPosition((g) => {
      const { latitude: lat, longitude: lng, accuracy, speed, heading } = g.coords, now = Date.now();
      pos = { lat, lng, acc: Math.round(accuracy), speed: speed != null && !isNaN(speed) ? speed : null, heading: heading != null && !isNaN(heading) ? heading : null };
      setGps('ok'); setMe({ lat, lng, acc: pos.acc, speed: pos.speed || 0, heading: pos.heading });
      const moved = last.lat == null ? 1e9 : km({ lat, lng }, last) * 1000;
      // بنبعت لما يتحرك 8 متر (بحد أدنى 5 ثواني) أو كل 20 ثانية على الأكتر، عشان نوفّر الكتابة
      if ((now - last.t >= 5000 && moved >= 8) || now - last.t >= 20000) push(pos, now);
    }, (er) => {
      if (er.code === 1) { toast(trs("اسمح بالوصول للموقع من إعدادات المتصفح")); setShare(false); } else setGps('weak');
    }, { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 });
    // نبضة: لو واقف في مكانه والمتصفح ما بعتش موقع جديد، نعيد إرسال آخر موقع كل 20 ثانية عشان العميل ما يفتكرش إن الإشارة قطعت
    const hb = setInterval(() => { if (pos && Date.now() - last.t >= 20000) push(pos, Date.now()); }, 10000);
    return () => { stop = true; clearInterval(hb); navigator.geolocation.clearWatch(wid); if (wl) wl.release(); };
  }, [share, ids, user.uid]);

  const deliver = async (o) => {
    setBusy(o.id);
    try { await updateDoc(doc(db, 'orders', o.id), { status: 'done', updatedAt: serverTimestamp() }); toast(trs("تم التسليم ✓")); setAsk(null); } catch (x) { toast(trs("تعذر التحديث: ") + errMsg(x)); }
    setBusy(null);
  };
  const done = (rows || []).filter((o) => o.status === 'done').length;
  const on = share && !!ids;
  const warnOff = !!ids && !on;
  return (
    <div className="cur">
      <h1>{trs("توصيلاتي")}{" "}<span className="mu sm2">· {profile.name}</span></h1>
      {loadErr && <p className="err" role="alert">{trs("تعذر تحميل التوصيلات: ") + loadErr}</p>}
      <section className={'shr ' + (on ? 'on' : 'off') + (warnOff ? ' warn' : '')} aria-live="polite">
        <div className="shr-st"><i className="shr-dot" /><b>{on ? 'ON' : 'OFF'}</b><span>{on ? trs("مشاركة الموقع شغّالة") : trs("مشاركة الموقع متوقفة")}</span></div>
        <p className="shr-tx">
          {on ? (sendErr ? <span className="err">{trs("تعذر إرسال الموقع: ") + sendErr}</span>
            : gps === 'weak' ? trs("الـ GPS ضعيف أو مش متاح. اتأكد إن الموقع شغّال وإنك مش جوه مبنى.")
            : sent ? trs("العميل شايفك دلوقتي · آخر إرسال ") + new Date(sent.t).toLocaleTimeString(lcl()) + trs(" · دقة ") + sent.acc + trs(" م") : trs("بنحدد موقعك…"))
            : warnOff ? trs("العميل مش شايف موقعك! اضغط ابدأ المشاركة.")
            : trs("مفيش توصيلات دلوقتي.")}
        </p>
        <button className={'btn shr-btn ' + (on ? 'o' : 'g')} disabled={!ids} onClick={() => setShare((v) => !v)}>{on ? trs("إيقاف المشاركة") : trs("ابدأ مشاركة الموقع")}</button>
        {on && <small className="mu">{trs("سيب الصفحة مفتوحة والشاشة منوّرة")}</small>}
      </section>

      {!rows && !loadErr && <div className="card" role="status" aria-busy="true"><div className="sk" style={{ height: 20, width: '50%' }} /><div className="sk" style={{ height: 46, marginTop: 14 }} /></div>}
      {rows && !active.length && <div className="card center empty"><Icon n="truck" s={44} /><h3>{trs("مفيش توصيلات دلوقتي")}</h3><p className="mu">{trs("أول ما الصيدلية تسلّمك طلب هيظهر هنا فوراً.")}</p></div>}
      {active.map((o) => (
        <div className="card dl" key={o.id}>
          <div className="row between wrap"><h3>{o.patientName}</h3><span className="bd am">{trs("في الطريق")}</span></div>
          <p className="dl-addr"><Icon n="pin" s={20} /> {o.address}</p>
          {o.note && <p className="dl-note"><Icon n="chat" s={16} /> {o.note}</p>}
          <div className="dl-pay"><span>{trs("حصّل من العميل (الدفع عند الاستلام)")}</span><b>{o.total} {trs("ج.م")}</b></div>
          <div className="dl-act">
            <a className="btn" href={mapsUrl(o)} target="_blank" rel="noopener noreferrer"><Icon n="nav" s={20} /> {o.dest ? trs("افتح الملاحة") : trs("افتح العنوان في الخرائط")}</a>
            <a className="btn o" href={'tel:' + o.phone}><Icon n="phone" s={20} /> {trs("اتصل بالعميل")}</a>
            <button className="btn g" disabled={busy === o.id} onClick={() => setAsk(o)}><Icon n="check" s={22} /> {trs("تم التسليم")}</button>
          </div>
          {!o.dest && <p className="mu sm2">{trs("العميل ما حدّدش موقعه على الخريطة، استخدم العنوان أو اتصل بيه.")}</p>}
          <details className="dl-more"><summary>{trs("تفاصيل الطلب والصيدلية")}</summary>
            <ul className="items">{o.items.map((i, k) => <li key={k}>{i.name} {i.dose && '(' + tdata(i.dose) + ')'} × {i.qty}</li>)}</ul>
            <div className="kv"><span className="mu"><Icon n="store" s={16} /></span><b>{o.pharmacyName}</b></div>
            {o.dest && <><button className="btn o sm" onClick={() => setOpen(open === o.id ? null : o.id)}><Icon n="pin" s={16} /> {open === o.id ? trs("إخفاء الخريطة") : trs("عرض الطريق")}</button>{open === o.id && <Nav o={o} me={me} />}</>}
          </details>
        </div>
      ))}
      {rows && done > 0 && <p className="mu sm2 c">{trs("اتسلّم")}{" "}{done} {trs("طلب.")}</p>}
      {ask && <div className="mo" role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && !busy && setAsk(null)}><div className="card narrow dl-ask">
        <h2>{trs("تأكيد التسليم")}</h2>
        <p>{trs("سلّمت الطلب لـ ")}<b>{ask.patientName}</b>{trs(" وحصّلت ")}<b>{ask.total} {trs("ج.م")}</b>{trs("؟")}</p>
        <p className="mu sm2">{trs("بعد التأكيد الطلب بيتقفل ومش هتقدر ترجّعه.")}</p>
        <button className="btn g full" disabled={busy === ask.id} onClick={() => deliver(ask)}>{busy === ask.id ? '…' : trs("أيوه، اتسلّم")}</button>
        <button className="btn o full" disabled={busy === ask.id} onClick={() => setAsk(null)}>{trs("رجوع")}</button>
      </div></div>}
    </div>
  );
}
