import { useEffect, useMemo, useState } from 'react';
import { loadCatalog } from '../lib/featured.js';
import { trs } from '../lib/i18n.js';

export default function Brands() {
  const [d, setD] = useState(null);
  useEffect(() => { loadCatalog().then(setD).catch(() => setD({ products: [], pharmacies: {} })); }, []);
  const list = useMemo(() => { const m = {}; (d?.products || []).forEach((g) => { if (g.brand) m[g.brand] = (m[g.brand] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])); }, [d]);
  return (
    <div>
      <h1>{trs("الماركات")}</h1>
      {!d && <div className="center mu">{trs("جاري التحميل…")}</div>}
      {d && !list.length && <div className="card center"><h3>{trs("لسه مفيش ماركات")}</h3><p className="mu">{trs("الماركات بتظهر لما الصيدليات تكتب ماركة المنتج.")}</p></div>}
      <div className="brands">{list.map(([b, n]) => <a key={b} className="brand-t" href={'#/shop?brand=' + encodeURIComponent(b)}><span>{b.slice(0, 2).toUpperCase()}</span><b>{b}</b><small>{n} {trs("منتج")}</small></a>)}</div>
    </div>
  );
}
