import { useEffect, useMemo, useState } from 'react';
import { loadCatalog } from '../lib/featured.js';
import { TREE, resolveCat, subsOf } from '../lib/cats.js';
import { norm } from '../lib/text.js';
import { Icon } from '../icons.jsx';
import { PCard } from '../shopparts.jsx';
import { trs } from '../lib/i18n.js';
import { useFavs } from '../lib/favs.js';

const SORTS = [['rel', 'الأكثر توفراً'], ['low', 'السعر: من الأقل'], ['high', 'السعر: من الأعلى'], ['off', 'أعلى خصم'], ['az', 'الاسم']];
const link = (o) => '#/shop?' + new URLSearchParams(Object.entries(o).filter(([, v]) => v)).toString();

export default function Shop({ q }) {
  const [cat, setCat] = useState(q.get('cat') || ''), [sub, setSub] = useState(q.get('sub') || ''), [brand, setBrand] = useState(q.get('brand') || '');
  const [form, setForm] = useState(''), [mn, setMn] = useState(''), [mx, setMx] = useState(''), [offers, setOffers] = useState(q.get('offers') === '1');
  const [fav, setFav] = useState(q.get('fav') === '1'), [text, setText] = useState(''), [sort, setSort] = useState(offers ? 'off' : 'rel'), [open, setOpen] = useState(false);
  const [data, setData] = useState(null), [err, setErr] = useState('');
  const favs = useFavs();
  useEffect(() => { loadCatalog().then(setData).catch((e) => setErr(e.code || e.message)); }, []);
  const all = data?.products || [];
  const withCat = useMemo(() => all.map((g) => { const [c, s] = resolveCat(g); return { ...g, c, s }; }), [all]);
  const base = useMemo(() => withCat.filter((g) => (!offers || g.off > 0) && (!fav || favs.includes(g.name))
    && (!brand || g.brand === brand) && (!form || g.form === form)
    && (!mn || g.min >= +mn) && (!mx || g.min <= +mx)
    && (!text || norm(g.name + ' ' + g.ingredient + ' ' + g.brand).includes(norm(text)))), [withCat, offers, fav, favs, brand, form, mn, mx, text]);
  const counts = useMemo(() => { const m = {}; base.forEach((g) => { m[g.c] = (m[g.c] || 0) + 1; }); return m; }, [base]);
  const rows = useMemo(() => {
    const r = base.filter((g) => (!cat || g.c === cat) && (!sub || g.s === sub));
    const by = { low: (a, b) => a.min - b.min, high: (a, b) => b.min - a.min, off: (a, b) => b.off - a.off || b.count - a.count, az: (a, b) => a.name.localeCompare(b.name, 'ar'), rel: (a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ar') };
    return [...r].sort(by[sort] || by.rel);
  }, [base, cat, sub, sort]);
  const brands = useMemo(() => [...new Set(withCat.map((g) => g.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [withCat]);
  const forms = useMemo(() => [...new Set(withCat.map((g) => g.form).filter(Boolean))], [withCat]);
  const title = fav ? trs("المفضلة") : offers ? trs("العروض") : brand ? brand : sub ? trs(sub) : cat ? trs(cat) : trs("كل المنتجات");
  const reset = () => { setCat(''); setSub(''); setBrand(''); setForm(''); setMn(''); setMx(''); setOffers(false); setFav(false); setText(''); };
  const filters = (
    <div className="flt">
      <div className="fgrp"><b>{trs("الأقسام")}</b>
        <button className={'fl' + (!cat ? ' on' : '')} onClick={() => { setCat(''); setSub(''); }}>{trs("الكل")}</button>
        {TREE.filter((t) => counts[t.k] || cat === t.k).map((t) => (
          <div key={t.k}>
            <button className={'fl' + (cat === t.k && !sub ? ' on' : '')} onClick={() => { setCat(t.k); setSub(''); }}>{trs(t.k)} <small>{counts[t.k] || 0}</small></button>
            {cat === t.k && <div className="fsub">{subsOf(t.k).map((s) => <button key={s} className={'fl' + (sub === s ? ' on' : '')} onClick={() => setSub(s)}>{trs(s)}</button>)}</div>}
          </div>))}
      </div>
      <div className="fgrp"><b>{trs("الماركة")}</b><select className="fi" value={brand} onChange={(e) => setBrand(e.target.value)}><option value="">{trs("كل الماركات")}</option>{brands.map((b) => <option key={b} value={b}>{b}</option>)}</select></div>
      <div className="fgrp"><b>{trs("الشكل")}</b><select className="fi" value={form} onChange={(e) => setForm(e.target.value)}><option value="">{trs("الكل")}</option>{forms.map((b) => <option key={b} value={b}>{trs(b)}</option>)}</select></div>
      <div className="fgrp"><b>{trs("السعر (ج.م)")}</b><div className="row g"><input className="fi" type="number" min="0" placeholder={trs("من")} value={mn} onChange={(e) => setMn(e.target.value)} /><input className="fi" type="number" min="0" placeholder={trs("إلى")} value={mx} onChange={(e) => setMx(e.target.value)} /></div></div>
      <label className="ck"><input type="checkbox" checked={offers} onChange={(e) => setOffers(e.target.checked)} /> {trs("العروض فقط")}</label>
      <label className="ck"><input type="checkbox" checked={fav} onChange={(e) => setFav(e.target.checked)} /> {trs("المفضلة فقط")}</label>
      <button className="btn o sm" onClick={reset}>{trs("مسح الفلاتر")}</button>
    </div>);
  return (
    <div className="shop">
      <h1>{title}</h1>
      <div className="row between wrap g shbar">
        <input className="fi shq" placeholder={trs("ابحث في المتجر…")} value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn o sm shfb" onClick={() => setOpen(true)}><Icon n="filter" s={16} /> {trs("فلاتر")}</button>
        <select className="fi sel" value={sort} onChange={(e) => setSort(e.target.value)} aria-label={trs("الترتيب")}>{SORTS.map(([k, l]) => <option key={k} value={k}>{trs(l)}</option>)}</select>
      </div>
      <div className="shgrid">
        <aside className="shside">{filters}</aside>
        <div>
          {err && <div className="card center"><p className="mu">{trs("تعذر تحميل المنتجات: ")}{err}</p></div>}
          {!data && !err && <div className="center mu">{trs("جاري التحميل…")}</div>}
          {data && <p className="mu sm2">{rows.length} {trs("منتج")}</p>}
          {data && !rows.length && <div className="card center"><h3>{trs("مفيش منتجات بالفلاتر دي")}</h3><p className="mu">{trs("جرّب تمسح الفلاتر أو تغيّر القسم.")}</p><button className="btn o" onClick={reset}>{trs("مسح الفلاتر")}</button></div>}
          <div className="rgrid">{rows.map((g) => <PCard key={g.key} g={g} phs={data.pharmacies} />)}</div>
        </div>
      </div>
      {open && <div className="mo shmo" onClick={(e) => e.target === e.currentTarget && setOpen(false)}><div className="card narrow shdr"><div className="row between"><h3>{trs("فلاتر")}</h3><button className="ic" onClick={() => setOpen(false)} aria-label={trs("إغلاق")}><Icon n="x" s={18} /></button></div>{filters}<button className="btn g" onClick={() => setOpen(false)}>{trs("عرض")} {rows.length} {trs("منتج")}</button></div></div>}
    </div>
  );
}
export { link as shopLink };
