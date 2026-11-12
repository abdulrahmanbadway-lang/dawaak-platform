import { useEffect, useMemo, useState } from 'react';
import { Icon } from './icons.jsx';
import { toast } from './ui.jsx';
import { trs } from './lib/i18n.js';
import { EG, citiesOf } from './lib/egypt.js';
import { askLocation, setManualGov, useWhere } from './lib/where.js';
import { km, fmtKm } from './lib/geo.js';

// شريط "موقعك": بيحدّد محافظتك تلقائياً، ولو رفضت بتختارها بنفسك
export function WhereChip({ phs }) {
  const w = useWhere();
  const [busy, setBusy] = useState(false), [pick, setPick] = useState(false);
  const near = useMemo(() => {
    if (!w || w.lat == null || !phs?.length) return null;
    const l = phs.filter((p) => p.lat != null && p.open !== false).map((p) => ({ p, d: km(w, p) })).sort((a, b) => a.d - b.d);
    return l[0] || null;
  }, [w, phs]);
  const locate = async () => {
    setBusy(true);
    try { await askLocation(); toast(trs("تم تحديد موقعك ✓")); setPick(false); }
    catch { toast(trs("اسمح بالوصول للموقع من إعدادات المتصفح، أو اختار محافظتك.")); setPick(true); }
    setBusy(false);
  };
  return (
    <div className="wch">
      <Icon n="pin" s={18} />
      {w?.gov ? <span className="wt"><b>{trs(w.gov)}</b>{near && <> · {trs("أقرب صيدلية:")} <b>{near.p.name}</b> ({fmtKm(near.d)})</>}</span>
        : <span className="wt">{trs("حدّد موقعك عشان نوريك أقرب صيدلية ليك")}</span>}
      <button className="btn o sm" onClick={locate} disabled={busy}>{busy ? '…' : w?.lat != null ? trs("حدّث") : trs("حدّد موقعي")}</button>
      <button className="btn o sm" onClick={() => setPick((x) => !x)}>{trs("اختار المحافظة")}</button>
      {pick && <select className="fi sel" value={w?.gov || ''} onChange={(e) => { setManualGov(e.target.value); setPick(false); }} autoFocus>
        <option value="">{trs("اختار المحافظة")}</option>{EG.map((g) => <option key={g.name} value={g.name}>{trs(g.name)}</option>)}</select>}
    </div>
  );
}

// كل محافظات مصر (27) بمدنها، وعدد الصيدليات الفعلي في كل واحدة
export function GovSection({ phs }) {
  const [open, setOpen] = useState('');
  const w = useWhere();
  const cnt = useMemo(() => { const m = {}, c = {}; (phs || []).forEach((p) => { m[p.governorate] = (m[p.governorate] || 0) + 1; if (p.city) c[p.governorate + '|' + p.city] = (c[p.governorate + '|' + p.city] || 0) + 1; }); return { m, c }; }, [phs]);
  useEffect(() => { if (w?.gov) setOpen((o) => o || w.gov); }, [w?.gov]);
  return (
    <section className="sec">
      <div className="sech"><h2>{trs("تصفّح")}{" "}<span className="gr">{trs("حسب المحافظة")}</span></h2></div>
      <p className="mu sm2">{trs("27 محافظة. اضغط على محافظتك لتشوف مدنها والصيدليات المتاحة فيها.")}</p>
      <div className="govs">
        {EG.map((g) => { const n = cnt.m[g.name] || 0, on = open === g.name; return (
          <div key={g.name} className={'gv' + (on ? ' on' : '') + (n ? ' has' : '')}>
            <button className="gvh" aria-expanded={on} onClick={() => setOpen(on ? '' : g.name)}>
              <b>{trs(g.name)}</b><span>{n ? n + ' ' + trs("صيدلية") : trs("قريباً")}</span>
            </button>
            {on && <div className="gvc">
              <a className="go" href={'#/area?gov=' + encodeURIComponent(g.name)}>{trs("كل صيدليات")} {trs(g.name)} ◂</a>
              <div className="cities">{citiesOf(g.name).map((c) => <a key={c} href={'#/area?gov=' + encodeURIComponent(g.name) + '&city=' + encodeURIComponent(c)}>{trs(c)}{cnt.c[g.name + '|' + c] ? <i>{cnt.c[g.name + '|' + c]}</i> : null}</a>)}</div>
            </div>}
          </div>
        ); })}
      </div>
    </section>
  );
}
