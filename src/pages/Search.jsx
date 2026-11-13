import { useEffect, useMemo, useState } from 'react';
import { collection, query, where, limit, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { Icon } from '../icons.jsx';
import { GOV } from '../lib/gov.js';
import { km, fmtKm } from '../lib/geo.js';
import { norm } from '../lib/text.js';
import { toast, Badge } from '../ui.jsx';
import { useCart, setQty } from '../lib/cart.js';
import { addOffer } from '../shopparts.jsx';
import { loadHome } from '../lib/featured.js';
import { ProdCard } from '../components.jsx';
import { trs, tdata } from '../lib/i18n.js';
import { getWhere, askLocation } from '../lib/where.js';
import { track } from '../lib/demand.js';

async function findProducts(text) {
  const t = norm(text), end = t + '\uf8ff', out = new Map();
  for (const f of ['nameLower', 'ingredientLower']) {
    const s = await getDocs(query(collection(db, 'products'), where(f, '>=', t), where(f, '<=', end), limit(60)));
    s.docs.forEach((d) => out.set(d.id, { id: d.id, ...d.data() }));
  }
  return [...out.values()];
}

export default function Search({ q }) {
  const [text, setText] = useState(q.get('q') || '');
  const [rows, setRows] = useState(null), [phs, setPhs] = useState({});
  const [loc, setLoc] = useState(() => { const w = getWhere(); return w && w.lat != null ? { lat: w.lat, lng: w.lng } : null; }), [gov, setGov] = useState(''), [busy, setBusy] = useState(false);
  const cart = useCart();
  const [feat, setFeat] = useState(null);
  useEffect(() => { if (!q.get('q')) loadHome().then((h) => setFeat(h.products)).catch(() => {}); }, []);

  const run = async (e) => {
    e?.preventDefault();
    if (norm(text).length < 2) return toast(trs("اكتب حرفين على الأقل"));
    setBusy(true); track('q', text);
    try {
      const ps = await findProducts(text), m = { ...phs };
      const ids = [...new Set(ps.map((p) => p.pharmacyId))];
      await Promise.all(ids.filter((i) => !m[i]).map(async (i) => {
        const s = await getDoc(doc(db, 'pharmacies', i));
        if (s.exists()) m[i] = { id: i, ...s.data() };
      }));
      setPhs(m);
      setRows(ps.filter((p) => m[p.pharmacyId] && m[p.pharmacyId].status === 'active' && m[p.pharmacyId].verified === true));
    } catch (x) { toast(trs("تعذر البحث: ") + x.message); }
    setBusy(false);
  };
  useEffect(() => { if (text) run(); }, []);
  const myLoc = async () => {
    try { const w = await askLocation(); setLoc({ lat: w.lat, lng: w.lng }); toast(trs("تم تحديد موقعك ✓")); }
    catch { toast(trs("اسمح بالوصول للموقع أو اختار المحافظة")); }
  };

  // نفس المنتج عند صيدلية تانية: نستخدم صورة حقيقية موجودة له لو الصيدلية دي ما رفعتش صورة
  const alt = useMemo(() => { const m = {}; (rows || []).forEach((p) => { if (p.imageUrl && !m[p.nameLower]) m[p.nameLower] = p.imageUrl; }); return m; }, [rows]);
  const groups = useMemo(() => {
    if (!rows) return null;
    const g = {};
    rows.forEach((p) => { (g[p.pharmacyId] ||= []).push(p); });
    return Object.entries(g).map(([id, items]) => {
      const ph = phs[id];
      const d = loc && ph.lat != null ? km(loc, ph) : null;
      return { ph, items, d, stock: items.some((i) => i.stock > 0) };
    }).filter((g) => !gov || g.ph.governorate === gov)
      .sort((a, b) => (b.stock - a.stock) || ((a.d ?? 1e9) - (b.d ?? 1e9)) || ((getWhere()?.gov === b.ph.governorate) - (getWhere()?.gov === a.ph.governorate)));
  }, [rows, phs, loc, gov]);

  const add = (p) => addOffer(p, phs[p.pharmacyId]?.name);
  const inCart = (p) => (cart.pid === p.pharmacyId ? cart.items[p.id]?.qty || 0 : 0);
  const n = Object.values(cart.items).reduce((a, x) => a + x.qty, 0), total = Object.values(cart.items).reduce((a, x) => a + x.price * x.qty, 0);

  return (
    <div>
      <h1>{trs("ابحث عن دوا")}</h1>
      <a className="card rxban" href="#/rx/new"><span className="hn"><Icon n="rx" s={24} /></span><div><b>{trs("عندك روشتة؟")}</b><p className="mu sm2">{trs("ارفع صورتها لأي صيدلية والصيدلي هيراجعها ويرد عليك بالأصناف والأسعار.")}</p></div><span className="go">{trs("ارفع روشتة ◂")}</span></a>
      <form className="sb" onSubmit={run}>
        <input name="q" value={text} onChange={(e) => setText(e.target.value)} placeholder={trs("اسم الدوا أو المادة الفعالة…")} />
        <button className="btn" disabled={busy}>{busy ? '…' : trs("ابحث")}</button>
      </form>
      <div className="row g wrap bar2">
        <button className="btn o sm" id="geo" onClick={myLoc}><Icon n="pin" s={16} /> {loc ? trs("تم تحديد موقعك") : trs("استخدم موقعي")}</button>
        <select className="fi sel" value={gov} onChange={(e) => setGov(e.target.value)}><option value="">{trs("كل المحافظات")}</option>{GOV.map((g) => <option key={g} value={g}>{trs(g)}</option>)}</select>
      </div>
      {!rows && feat && feat.length > 0 && <><div className="row between wrap"><h2 className="mt">{trs("منتجات متاحة الآن")}</h2><a className="go" href="#/shop">{trs("تصفّح كل المنتجات ◂")}</a></div><div className="pgrid">{feat.map((p) => <ProdCard key={p.name} p={p} />)}</div></>}
      {groups && !groups.length && <div className="card center"><h3>{trs("مفيش نتايج")}</h3><p className="mu">{trs("جرّب اسم تاني أو المادة الفعالة، أو غيّر المحافظة.")}</p></div>}
      {groups?.map(({ ph, items, d, stock }) => (
        <div className="card ph" key={ph.id}>
          <div className="row between wrap">
            <div><h3>{ph.name}</h3>
              <p className="mu sm2">{trs(ph.governorate)} · <bdi>{ph.address}</bdi>{ph.hours ? ' · ' + tdata(ph.hours) : ''}</p></div>
            <div className="tr">{d != null && <b className="dist">{fmtKm(d)}</b>}
              <div><Badge c={ph.open ? 'ok' : 'rd'}>{ph.open ? trs("مفتوحة") : trs("مغلقة")}</Badge> <Badge c={stock ? 'ok' : 'rd'}>{stock ? trs("متاح") : trs("نفد")}</Badge></div></div>
          </div>
          {items.map((p) => (
            <div className="prod" key={p.id}>
              {p.imageUrl || alt[p.nameLower] ? <img src={p.imageUrl || alt[p.nameLower]} alt={p.name} loading="lazy" /> : <div className="noimg"><Icon n="pill" s={30} /></div>}
              <div className="pi">
                <b>{p.name}</b> {p.rx && <Badge c="am">{trs("يحتاج روشتة")}</Badge>}
                <div className="mu sm2">{[tdata(p.dose), tdata(p.form), p.ingredient].filter(Boolean).join(' · ')}</div>
                {(p.description || p.warnings) && <details><summary>{trs("التفاصيل")}</summary>
                  {p.description && <p><b>{trs("الاستخدام:")}</b> {p.description}</p>}{p.warnings && <p><b>{trs("تحذيرات:")}</b> {p.warnings}</p>}</details>}
              </div>
              <div className="pr"><b>{p.price} {trs("ج.م")}</b>
                {p.stock > 0 ? (p.rx ? <a className="go" href={'#/rx/new?ph=' + p.pharmacyId}>{trs("ارفع روشتة ◂")}</a> :
                  inCart(p) ? <div className="qty"><button onClick={() => setQty(p.id, inCart(p) - 1)}>−</button><span>{inCart(p)}</span><button onClick={() => add(p)}>＋</button></div>
                    : <button className="btn sm" onClick={() => add(p)}>{trs("أضف للطلب")}</button>)
                  : <Badge c="rd">{trs("نفد")}</Badge>}</div>
            </div>
          ))}
        </div>
      ))}
      {n > 0 && <div className="cartbar"><span>{n} {trs("عنصر ·")}{" "}<b>{total} {trs("ج.م")}</b> · {cart.pname}</span><a className="btn g" href="#/cart">{trs("عرض السلة")}</a></div>}
    </div>
  );
}
