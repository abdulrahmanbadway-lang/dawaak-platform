import { useEffect, useMemo, useState } from 'react';
import { Icon } from './icons.jsx';
import { Badge, toast } from './ui.jsx';
import TileMap from './tilemap.jsx';
import { trs, tdata } from './lib/i18n.js';
import { EG } from './lib/egypt.js';
import { askLocation, freshDest, setManualGov, useWhere } from './lib/where.js';
import { km, fmtKm } from './lib/geo.js';

const near = (w, phs) => (w && w.lat != null ? (phs || []).filter((p) => p.lat != null && p.status !== 'suspended').map((p) => ({ p, d: km(w, p) })).sort((a, b) => (b.p.open - a.p.open) || (a.d - b.d)) : []);

// شريط "موقعك": بيحدد موقعك الدقيق أول ما تدخل، ولو رفضت بتقدر تختار محافظتك
export function WhereChip({ phs }) {
  const w = useWhere();
  const [busy, setBusy] = useState(false), [pick, setPick] = useState(false);
  const first = useMemo(() => near(w, phs)[0], [w, phs]);
  const locate = async () => {
    setBusy(true);
    try { await askLocation(); toast(trs("تم تحديد موقعك بدقة ✓")); setPick(false); }
    catch { toast(trs("اسمح بالوصول للموقع من إعدادات المتصفح، أو اختار محافظتك.")); setPick(true); }
    setBusy(false);
  };
  const precise = w && w.lat != null;
  return (
    <div className="wch">
      <Icon n="pin" s={18} />
      {precise ? <span className="wt"><b>{trs("تم تحديد موقعك الدقيق")}</b>{w.acc != null && <> (±{w.acc} {trs("م")})</>}{first && <> · {trs("أقرب صيدلية:")} <b>{first.p.name}</b> ({fmtKm(first.d)})</>}</span>
        : w?.gov ? <span className="wt">{trs("المحافظة:")} <b>{trs(w.gov)}</b> · {trs("فعّل الموقع لتحديد أقرب صيدلية بدقة")}</span>
          : <span className="wt">{trs("حدّد موقعك عشان نوريك الصيدليات اللي جنبك")}</span>}
      <button className="btn o sm" onClick={locate} disabled={busy}>{busy ? '…' : precise ? trs("حدّث") : trs("حدّد موقعي")}</button>
      {!precise && <button className="btn o sm" onClick={() => setPick((x) => !x)}>{trs("اختار المحافظة")}</button>}
      {pick && <select className="fi sel" value={w?.gov || ''} onChange={(e) => { setManualGov(e.target.value); setPick(false); }} autoFocus>
        <option value="">{trs("اختار المحافظة")}</option>{EG.map((g) => <option key={g.name} value={g.name}>{trs(g.name)}</option>)}</select>}
    </div>
  );
}

// الصيدليات اللي جنبك: خريطة + قائمة مرتبة بالأقرب (من موقعك الدقيق)
export function NearSection({ phs }) {
  const w = useWhere();
  const [busy, setBusy] = useState(false);
  const list = useMemo(() => near(w, phs).slice(0, 8), [w, phs]);
  const locate = async () => { setBusy(true); try { await askLocation(); } catch { toast(trs("اسمح بالوصول للموقع من إعدادات المتصفح.")); } setBusy(false); };
  const precise = w && w.lat != null;
  const markers = precise ? [{ id: 'me', kind: 'dest', lat: w.lat, lng: w.lng, label: trs("موقعك") }, ...list.map(({ p }) => ({ id: p.id, kind: 'pharmacy', lat: p.lat, lng: p.lng, label: p.name }))] : [];
  return (
    <section className="sec">
      <div className="sech"><h2>{trs("صيدليات")}{" "}<span className="gr">{trs("جنبك دلوقتي")}</span></h2></div>
      {!precise && <div className="card center"><h3>{trs("فعّل الموقع عشان نوريك الصيدليات اللي جنبك")}</h3><p className="mu">{trs("بنستخدم موقعك لترتيب الصيدليات بالأقرب، وعشان المندوب يوصلك للعنوان بالضبط.")}</p>
        <button className="btn" onClick={locate} disabled={busy}>{busy ? '…' : trs("حدّد موقعي بدقة")}</button></div>}
      {precise && !list.length && <div className="card center"><p className="mu">{trs("لسه مفيش صيدليات حدّدت موقعها على الخريطة في المنطقة دي.")}</p><a className="btn" href="#/register?role=pharmacy">{trs("عندك صيدلية؟ انضم لدواك")}</a></div>}
      {list.length > 0 && <>
        <div className="card nmap"><TileMap markers={markers} height={300} /></div>
        <div className="nlist">{list.map(({ p, d }) => (
          <div className="card nph" key={p.id}>
            <div className="phi"><Icon n="store" s={22} /></div>
            <div className="nb"><b>{p.name}</b> {p.verified && <Badge c="ok">{trs("موثّقة")}</Badge>} <Badge c={p.open ? 'ok' : 'rd'}>{p.open ? trs("مفتوحة") : trs("مغلقة")}</Badge>
              <p className="mu sm2">{trs(p.governorate)} · <bdi>{p.address}</bdi>{p.hours ? ' · ' + tdata(p.hours) : ''}</p></div>
            <div className="nd"><b>{fmtKm(d)}</b><a className="go" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`}>{trs("الاتجاهات ◂")}</a></div>
          </div>))}</div>
      </>}
    </section>
  );
}

// موقع التوصيل: بيتحدد تلقائياً من موقعك الدقيق (GPS) عشان المندوب يوصل للعنوان بالضبط
export function DestPick({ dest, onChange }) {
  const w = useWhere();
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!dest) { const d = freshDest(); if (d) onChange({ lat: d.lat, lng: d.lng }); } }, [w?.ts]); // eslint-disable-line react-hooks/exhaustive-deps
  const acc = dest && w && w.lat != null && Math.abs(w.lat - dest.lat) < 1e-4 ? w.acc : null;
  const upd = async () => {
    setBusy(true);
    try { const c = await askLocation(); onChange({ lat: +c.lat.toFixed(6), lng: +c.lng.toFixed(6) }); toast(trs("تم تحديد موقع التوصيل بدقة ✓")); }
    catch { toast(trs("اسمح بالوصول للموقع من إعدادات المتصفح عشان المندوب يوصلك بالضبط")); }
    setBusy(false);
  };
  return (
    <div className={'dp' + (dest ? ' ok' : '')}>
      <Icon n="pin" s={20} />
      <div className="dpt">{dest
        ? <><b>{trs("تم تحديد موقع التوصيل ✓")}</b>{acc != null && <> · {trs("الدقة")} ±{acc} {trs("م")}</>}<p className="mu sm2">{acc != null && acc > 100 ? trs("الدقة ضعيفة: شغّل GPS وجرّب تاني، وتأكد إنك برّه أو جنب شباك.") : trs("المندوب هيشوف موقعك على الخريطة ويوصلك بالضبط.")}</p></>
        : <><b>{trs("حدّد موقع التوصيل بدقة")}</b><p className="mu sm2">{trs("من غيره المندوب هيعتمد على العنوان المكتوب بس، وهتفقد تتبع الطلب على الخريطة.")}</p></>}</div>
      <button type="button" className="btn o sm" onClick={upd} disabled={busy}>{busy ? '…' : dest ? trs("حدّث") : trs("حدّد موقعي")}</button>
    </div>
  );
}
