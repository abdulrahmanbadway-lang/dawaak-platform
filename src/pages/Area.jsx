import { useEffect, useMemo, useState } from 'react';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase.js';
import { PharmCard } from '../components.jsx';
import { trs } from '../lib/i18n.js';
import { citiesOf } from '../lib/egypt.js';
import { useWhere } from '../lib/where.js';
import { km, fmtKm } from '../lib/geo.js';

// صيدليات محافظة (ومدينة اختيارياً)
export default function Area({ q }) {
  const gov = q.get('gov') || '', city = q.get('city') || '', w = useWhere();
  const [rows, setRows] = useState(null);
  useEffect(() => {
    if (!gov) { setRows([]); return; }
    getDocs(query(collection(db, 'pharmacies'), where('governorate', '==', gov), limit(100)))
      .then((s) => setRows(s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => p.status === 'active'))).catch(() => setRows([]));
  }, [gov]);
  const list = useMemo(() => (rows || []).filter((p) => !city || p.city === city || (p.address || '').includes(city))
    .map((p) => ({ p, d: w && w.lat != null && p.lat != null ? km(w, p) : null }))
    .sort((a, b) => (b.p.open - a.p.open) || ((a.d ?? 1e9) - (b.d ?? 1e9))), [rows, city, w]);
  return (
    <div>
      <p className="mu sm2"><a href="#/">{trs("الرئيسية")}</a> ◂ {trs(gov || "المحافظات")}{city ? ' ◂ ' + trs(city) : ''}</p>
      <h1>{trs("صيدليات")} {trs(city || gov)}</h1>
      {gov && <div className="cities mt">{citiesOf(gov).map((c) => <a key={c} className={c === city ? 'on' : ''} href={'#/area?gov=' + encodeURIComponent(gov) + (c === city ? '' : '&city=' + encodeURIComponent(c))}>{trs(c)}</a>)}</div>}
      {rows === null && <div className="center">{trs("جاري التحميل…")}</div>}
      {rows && !list.length && <div className="card center"><h3>{trs("لسه مفيش صيدليات هنا")}</h3><p className="mu">{trs("أول ما صيدلية تنضم في المنطقة دي هتظهر هنا.")}</p><a className="btn" href="#/register?role=pharmacy">{trs("عندك صيدلية؟ انضم لدواك")}</a></div>}
      <div className="phgrid">{list.map(({ p, d }) => <div key={p.id}><PharmCard p={p} />{d != null && <p className="mu sm2 c">{fmtKm(d)}</p>}</div>)}</div>
    </div>
  );
}
