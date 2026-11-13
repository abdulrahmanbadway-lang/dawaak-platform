import { useEffect, useMemo, useState } from 'react';
import { loadCatalog } from '../lib/featured.js';
import { resolveCat } from '../lib/cats.js';
import { Icon } from '../icons.jsx';
import { Badge } from '../ui.jsx';
import { PCard, FavBtn, addOffer } from '../shopparts.jsx';
import { km, fmtKm, getPos } from '../lib/geo.js';
import { useCart, setQty } from '../lib/cart.js';
import { toast } from '../ui.jsx';
import { trs, tdata, pharmWord } from '../lib/i18n.js';

export default function Product({ id }) {
  const [d, setD] = useState(null), [loc, setLoc] = useState(null);
  const cart = useCart();
  useEffect(() => { loadCatalog().then(setD).catch(() => setD({ products: [], pharmacies: {} })); }, []);
  const key = decodeURIComponent(id || '');
  const g = d?.products.find((x) => x.key === key || x.name === key);
  const [c, s] = g ? resolveCat(g) : ['', ''];
  const offers = useMemo(() => (g ? g.offers.map((o) => ({ o, ph: d.pharmacies[o.pharmacyId], dist: loc && d.pharmacies[o.pharmacyId]?.lat != null ? km(loc, d.pharmacies[o.pharmacyId]) : null }))
    .sort((a, b) => ((b.o.stock > 0) - (a.o.stock > 0)) || ((a.dist ?? 1e9) - (b.dist ?? 1e9)) || a.o.price - b.o.price) : []), [g, d, loc]);
  const similar = useMemo(() => (g ? d.products.filter((x) => x.key !== g.key && resolveCat(x)[0] === c && c).slice(0, 12) : []), [g, d, c]);
  if (!d) return <div className="center mu">{trs("جاري التحميل…")}</div>;
  if (!g) return <div className="card center"><h2>{trs("المنتج مش موجود أو مش متاح دلوقتي")}</h2><a className="btn" href="#/shop">{trs("تصفّح المتجر")}</a></div>;
  return (
    <div className="pdp">
      <p className="mu sm2 crumbs"><a href="#/">{trs("الرئيسية")}</a> ‹ <a href="#/shop">{trs("المتجر")}</a>{c && <> ‹ <a href={'#/shop?cat=' + encodeURIComponent(c)}>{trs(c)}</a></>}{s && <> ‹ <a href={'#/shop?cat=' + encodeURIComponent(c) + '&sub=' + encodeURIComponent(s)}>{trs(s)}</a></>}</p>
      <div className="pdp-top">
        <div className="pdp-img">{g.imageUrl ? <img src={g.imageUrl} alt={g.name} /> : <Icon n="pill" s={90} />}{g.off > 0 && <em className="off">-{g.off}%</em>}</div>
        <div className="pdp-info">
          <div className="row between"><h1>{g.name}</h1><FavBtn name={g.name} cls="big" /></div>
          {g.brand && <a className="chip" href={'#/shop?brand=' + encodeURIComponent(g.brand)}>{g.brand}</a>}
          <p className="mu">{[tdata(g.dose), tdata(g.form), g.ingredient].filter(Boolean).join(' · ')}</p>
          <div className="pdp-pr"><b>{g.min === g.max ? g.min : trs("من ") + g.min} <small>{trs("ج.م")}</small></b>{g.off > 0 && <del>{g.oldMax} {trs("ج.م")}</del>}</div>
          <p className="mu sm2">{trs("متاح في")}{" "}{g.count} {pharmWord(g.count)} · {trs("الدفع عند الاستلام")}</p>
          {g.description && <><h3>{trs("الاستخدام")}</h3><p>{g.description}</p></>}
          {g.warnings && <><h3>{trs("تحذيرات")}</h3><p>{g.warnings}</p></>}
          <p className="mu sm2">{trs("المحتوى إرشادي ولا يغني عن استشارة الطبيب أو الصيدلي.")}</p>
        </div>
      </div>
      <div className="row between wrap g" style={{ marginTop: 22 }}><h2>{trs("الصيدليات اللي عندها المنتج")}</h2>
        <button className="btn o sm" onClick={async () => { try { setLoc(await getPos()); } catch { toast(trs("اسمح بالوصول للموقع")); } }}><Icon n="pin" s={16} /> {loc ? trs("مرتبة بالأقرب") : trs("رتّب بالأقرب ليا")}</button></div>
      {offers.map(({ o, ph, dist }) => { const inCart = cart.pid === o.pharmacyId ? cart.items[o.id]?.qty || 0 : 0; return (
        <div className="card ph offer" key={o.id}>
          <div className="row between wrap g">
            <div><h3>{ph.name}</h3>
              <p className="mu sm2">{trs(ph.governorate)} · <bdi>{ph.address}</bdi>{ph.hours ? ' · ' + tdata(ph.hours) : ''}{dist != null ? ' · ' + fmtKm(dist) : ''}</p>
              <Badge c={ph.open ? 'ok' : 'rd'}>{ph.open ? trs("مفتوحة") : trs("مغلقة")}</Badge></div>
            <div className="tr"><b className="price">{o.price} <small>{trs("ج.م")}</small></b>{o.oldPrice > o.price && <del className="mu"> {o.oldPrice}</del>}
              <div>{o.stock > 0 ? (inCart ? <div className="qty"><button onClick={() => setQty(o.id, inCart - 1)}>−</button><span>{inCart}</span><button onClick={() => addOffer(o, ph.name)}>＋</button></div>
                : <button className="btn sm" onClick={() => addOffer(o, ph.name)}>{trs("أضف للسلة")}</button>) : <Badge c="rd">{trs("نفد")}</Badge>}</div></div>
          </div>
        </div>); })}
      {similar.length > 0 && <><h2 className="mt">{trs("منتجات مشابهة")}</h2><div className="rail">{similar.map((x) => <PCard key={x.key} g={x} phs={d.pharmacies} />)}</div></>}
    </div>
  );
}
