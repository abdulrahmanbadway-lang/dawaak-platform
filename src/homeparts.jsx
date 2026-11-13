import { useEffect, useRef, useState } from 'react';
import { Icon } from './icons.jsx';
import { CATS, catHue, resolveCat } from './lib/cats.js';
import { PCard } from './shopparts.jsx';
import { trs, tdata } from './lib/i18n.js';
import './home.css';

const SAFE = /^(#\/|https:\/\/)/;
// إعلانات جاهزة بتظهر لما الأدمن ما يكونش ضاف إعلانات. دي مزايا حقيقية في الموقع مش عروض.
const BUILTIN = [
  { builtin: true, id: 'b1', title: 'عندك روشتة؟', sub: 'ارفع صورتها والصيدلي هيراجعها ويرد عليك بالأصناف والأسعار.', cta: 'ارفع الروشتة', link: '#/rx/new', tone: 0 },
  { builtin: true, id: 'b2', title: 'تتبّع طلبك لحظة بلحظة', sub: 'من التحضير لحد ما المندوب يوصلك، على الخريطة.', cta: 'طلباتي', link: '#/orders', tone: 1 },
  { builtin: true, id: 'b3', title: 'عندك صيدلية؟ انضم لدواك', sub: 'ارفع أدويتك وأسعارك واستقبل طلبات المرضى القريبين منك.', cta: 'سجّل صيدليتك', link: '#/register?role=pharmacy', tone: 2 },
];

export function Banners({ list }) {
  const items = list && list.length ? list : BUILTIN;
  const el = useRef(null), hold = useRef(false), cur = useRef(0);
  const [i, setI] = useState(0);
  // نحرّك شريط الإعلانات أفقياً بس (scrollTo على الشريط نفسه). scrollIntoView كان بيسحب الصفحة كلها لفوق كل 5 ثواني.
  const goTo = (n) => {
    const e = el.current; if (!e) return;
    const dir = getComputedStyle(e).direction === 'rtl' ? -1 : 1;
    cur.current = n;
    e.scrollTo({ left: dir * n * e.clientWidth, behavior: 'smooth' });
  };
  useEffect(() => {
    if (items.length < 2) return undefined;
    const t = setInterval(() => { if (!hold.current && !document.hidden) { const n = (cur.current + 1) % items.length; goTo(n); setI(n); } }, 5000);
    return () => clearInterval(t);
  }, [items.length]);
  const onScroll = () => { const e = el.current; if (!e) return; const n = Math.round(Math.abs(e.scrollLeft) / (e.clientWidth || 1)); if (n >= 0 && n < items.length && n !== cur.current) { cur.current = n; setI(n); } };
  return (
    <section className="bnr" onMouseEnter={() => { hold.current = true; }} onMouseLeave={() => { hold.current = false; }} onTouchStart={() => { hold.current = true; }} onTouchEnd={() => { setTimeout(() => { hold.current = false; }, 4000); }}>
      <div className="bnr-t" ref={el} onScroll={onScroll}>
        {items.map((b) => {
          const link = b.link && SAFE.test(b.link) ? b.link : undefined;
          return b.imageUrl
            ? <a className="adv adv-img" key={b.id} href={link} {...(link && link.startsWith('https') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                <img src={b.imageUrl} alt={b.title || ''} loading="lazy" />
                {(b.title || b.sub) && <div className="adv-tx">{b.title && <b>{b.title}</b>}{b.sub && <span>{b.sub}</span>}</div>}
              </a>
            : <a className={'adv adv-t' + (b.tone || 0)} key={b.id} href={link}>
                <div className="adv-tx"><b>{b.builtin ? trs(b.title) : b.title}</b><span>{b.builtin ? trs(b.sub) : b.sub}</span>{b.cta && <em>{trs(b.cta)}</em>}</div>
                <Icon n={['rx', 'truck', 'store'][b.tone || 0]} s={96} />
              </a>;
        })}
      </div>
      {items.length > 1 && <div className="bnr-d" role="tablist">{items.map((b, k) => <button key={b.id} className={k === i ? 'on' : ''} aria-label={String(k + 1)} onClick={() => { setI(k); goTo(k); }} />)}</div>}
    </section>
  );
}

const catOf = (p) => resolveCat(p)[0] || 'أخرى';

export function CatTiles({ products }) {
  const by = {};
  products.forEach((p) => { (by[catOf(p)] = by[catOf(p)] || []).push(p); });
  const cats = [...CATS, 'أخرى'].filter((c) => by[c]);
  if (!cats.length) return null;
  return (
    <section className="sec">
      <div className="sech"><h2>{trs("الأقسام")}</h2></div>
      <div className="cats">{cats.map((c) => { const im = by[c].find((p) => p.imageUrl); return (
        <a key={c} className="cat" href={c === 'أخرى' ? '#/shop' : '#/shop?cat=' + encodeURIComponent(c)} style={{ '--h': catHue(c) }}>
          <span className="cat-i">{im ? <img src={im.imageUrl} alt="" loading="lazy" /> : <Icon n="pill" s={30} />}</span>
          <b>{trs(c)}</b><small>{by[c].length}</small>
        </a>); })}</div>
    </section>
  );
}

export function Rails({ products, phs }) {
  const by = {};
  products.forEach((p) => { (by[catOf(p)] = by[catOf(p)] || []).push(p); });
  return [...CATS, 'أخرى'].filter((c) => by[c]).map((c) => (
    <section className="sec rl" key={c}>
      <div className="sech"><h2>{trs(c)}</h2><a className="go btn o sm" href={c === 'أخرى' ? '#/shop' : '#/shop?cat=' + encodeURIComponent(c)}>{trs("عرض الكل")}</a></div>
      <div className="rail">{by[c].slice(0, 14).map((p) => <PCard key={p.key || p.name} g={p} phs={phs} />)}</div>
    </section>
  ));
}

export function OffersRail({ products, phs }) {
  const l = products.filter((p) => p.off > 0).sort((a, b) => b.off - a.off).slice(0, 14);
  if (!l.length) return null;
  return (
    <section className="sec rl">
      <div className="sech"><h2>{trs("العروض")}</h2><a className="go btn o sm" href="#/shop?offers=1">{trs("عرض الكل")}</a></div>
      <div className="rail">{l.map((p) => <PCard key={p.key} g={p} phs={phs} />)}</div>
    </section>
  );
}

export function BrandsRow({ products }) {
  const m = {};
  products.forEach((p) => { if (p.brand) m[p.brand] = (m[p.brand] || 0) + 1; });
  const l = Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 14);
  if (!l.length) return null;
  return (
    <section className="sec rl">
      <div className="sech"><h2>{trs("الماركات")}</h2><a className="go btn o sm" href="#/brands">{trs("عرض الكل")}</a></div>
      <div className="rail brails">{l.map(([b, n]) => <a key={b} className="brand-t" href={'#/shop?brand=' + encodeURIComponent(b)}><span>{b.slice(0, 2).toUpperCase()}</span><b>{b}</b><small>{n} {trs("منتج")}</small></a>)}</div>
    </section>
  );
}
