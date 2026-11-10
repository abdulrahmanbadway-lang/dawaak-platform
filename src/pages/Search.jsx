import { useEffect, useMemo, useState } from 'react';
import { collection, query, where, limit, getDocs, getDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useAuth } from '../auth.jsx';
import { go } from '../router.js';
import { Icon } from '../icons.jsx';
import { GOV } from '../lib/gov.js';
import { km, fmtKm, getPos } from '../lib/geo.js';
import { norm } from '../lib/text.js';
import { toast, Badge, Field } from '../ui.jsx';
import { loadHome } from '../lib/featured.js';
import { ProdCard } from '../components.jsx';

async function findProducts(text) {
  const t = norm(text), end = t + '\uf8ff', out = new Map();
  for (const f of ['nameLower', 'ingredientLower']) {
    const s = await getDocs(query(collection(db, 'products'), where(f, '>=', t), where(f, '<=', end), limit(60)));
    s.docs.forEach((d) => out.set(d.id, { id: d.id, ...d.data() }));
  }
  return [...out.values()];
}

export default function Search({ q }) {
  const { user, profile } = useAuth();
  const [text, setText] = useState(q.get('q') || '');
  const [rows, setRows] = useState(null), [phs, setPhs] = useState({});
  const [loc, setLoc] = useState(null), [gov, setGov] = useState(''), [busy, setBusy] = useState(false);
  const [cart, setCart] = useState({ pid: null, items: {} });
  const [co, setCo] = useState(null);
  const [feat, setFeat] = useState(null);
  useEffect(() => { if (!q.get('q')) loadHome().then((h) => setFeat(h.products)).catch(() => {}); }, []);

  const run = async (e) => {
    e?.preventDefault();
    if (norm(text).length < 2) return toast('اكتب حرفين على الأقل');
    setBusy(true);
    try {
      const ps = await findProducts(text), m = { ...phs };
      const ids = [...new Set(ps.map((p) => p.pharmacyId))];
      await Promise.all(ids.filter((i) => !m[i]).map(async (i) => {
        const s = await getDoc(doc(db, 'pharmacies', i));
        if (s.exists()) m[i] = { id: i, ...s.data() };
      }));
      setPhs(m);
      setRows(ps.filter((p) => m[p.pharmacyId] && m[p.pharmacyId].status === 'active'));
    } catch (x) { toast('تعذر البحث: ' + x.message); }
    setBusy(false);
  };
  useEffect(() => { if (text) run(); }, []);
  const myLoc = async () => {
    try { setLoc(await getPos()); toast('تم تحديد موقعك ✓'); }
    catch { toast('اسمح بالوصول للموقع أو اختار المحافظة'); }
  };

  const groups = useMemo(() => {
    if (!rows) return null;
    const g = {};
    rows.forEach((p) => { (g[p.pharmacyId] ||= []).push(p); });
    return Object.entries(g).map(([id, items]) => {
      const ph = phs[id];
      const d = loc && ph.lat != null ? km(loc, ph) : null;
      return { ph, items, d, stock: items.some((i) => i.stock > 0) };
    }).filter((g) => !gov || g.ph.governorate === gov)
      .sort((a, b) => (b.stock - a.stock) || ((a.d ?? 1e9) - (b.d ?? 1e9)));
  }, [rows, phs, loc, gov]);

  const add = (p) => {
    if (cart.pid && cart.pid !== p.pharmacyId && Object.keys(cart.items).length) {
      if (!confirm('الطلب بيكون من صيدلية واحدة بس. تفريغ السلة الحالية وإضافة المنتج ده؟')) return;
      setCart({ pid: p.pharmacyId, items: { [p.id]: { p, qty: 1 } } });
      return;
    }
    const cur = cart.items[p.id]?.qty || 0;
    if (cur >= p.stock) return toast('الكمية المتاحة ' + p.stock + ' فقط');
    setCart({ pid: p.pharmacyId, items: { ...cart.items, [p.id]: { p, qty: cur + 1 } } });
  };
  const rem = (id) => {
    const it = { ...cart.items }; const c = it[id];
    if (c.qty <= 1) delete it[id]; else it[id] = { ...c, qty: c.qty - 1 };
    setCart({ pid: Object.keys(it).length ? cart.pid : null, items: it });
  };
  const list = Object.values(cart.items);
  const total = list.reduce((s, x) => s + x.p.price * x.qty, 0);

  const startCheckout = () => {
    if (!user) { toast('سجّل دخولك الأول عشان تكمل الطلب'); return go('/login'); }
    if (profile?.role !== 'patient') return toast('الطلب متاح لحسابات المرضى فقط');
    setCo({ phone: '', address: '', note: '', dest: null });
  };
  const send = async (e) => {
    e.preventDefault();
    if (co.phone.trim().length < 8 || co.address.trim().length < 5) return toast('اكتب رقم الموبايل والعنوان بالتفصيل');
    try {
      await addDoc(collection(db, 'orders'), {
        patientId: user.uid, patientName: profile.name, phone: co.phone.trim(), address: co.address.trim(), note: co.note.trim(),
        pharmacyId: cart.pid, pharmacyName: phs[cart.pid].name,
        items: list.map((x) => ({ productId: x.p.id, name: x.p.name, dose: x.p.dose || '', price: x.p.price, qty: x.qty })),
        ...(co.dest ? { dest: co.dest } : {}),
        total, status: 'new', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      toast('تم إرسال طلبك للصيدلية ✓'); setCart({ pid: null, items: {} }); setCo(null); go('/orders');
    } catch (x) { toast('تعذر إرسال الطلب: ' + x.message); }
  };

  return (
    <div>
      <h1>ابحث عن دوا</h1>
      <a className="card rxban" href="#/rx/new"><span className="hn"><Icon n="rx" s={24} /></span><div><b>عندك روشتة؟</b><p className="mu sm2">ارفع صورتها لأي صيدلية والصيدلي هيراجعها ويرد عليك بالأصناف والأسعار.</p></div><span className="go">ارفع روشتة ◂</span></a>
      <form className="sb" onSubmit={run}>
        <input name="q" value={text} onChange={(e) => setText(e.target.value)} placeholder="اسم الدوا أو المادة الفعالة…" />
        <button className="btn" disabled={busy}>{busy ? '…' : 'ابحث'}</button>
      </form>
      <div className="row g wrap bar2">
        <button className="btn o sm" id="geo" onClick={myLoc}><Icon n="pin" s={16} /> {loc ? 'تم تحديد موقعك' : 'استخدم موقعي'}</button>
        <select className="fi sel" value={gov} onChange={(e) => setGov(e.target.value)}><option value="">كل المحافظات</option>{GOV.map((g) => <option key={g}>{g}</option>)}</select>
      </div>
      {!rows && feat && feat.length > 0 && <><h2 className="mt">منتجات متاحة الآن</h2><div className="pgrid">{feat.map((p) => <ProdCard key={p.name} p={p} />)}</div></>}
      {groups && !groups.length && <div className="card center"><h3>مفيش نتايج</h3><p className="mu">جرّب اسم تاني أو المادة الفعالة، أو غيّر المحافظة.</p></div>}
      {groups?.map(({ ph, items, d, stock }) => (
        <div className="card ph" key={ph.id}>
          <div className="row between wrap">
            <div><h3>{ph.name} {ph.verified ? <Badge c="ok">موثّقة</Badge> : <Badge c="am">قيد التوثيق</Badge>}</h3>
              <p className="mu sm2">{ph.governorate} · {ph.address}{ph.hours ? ' · ' + ph.hours : ''}</p></div>
            <div className="tr">{d != null && <b className="dist">{fmtKm(d)}</b>}
              <div><Badge c={ph.open ? 'ok' : 'rd'}>{ph.open ? 'مفتوحة' : 'مغلقة'}</Badge> <Badge c={stock ? 'ok' : 'rd'}>{stock ? 'متاح' : 'نفد'}</Badge></div></div>
          </div>
          {items.map((p) => (
            <div className="prod" key={p.id}>
              {p.imageUrl ? <img src={p.imageUrl} alt="" /> : <div className="noimg">💊</div>}
              <div className="pi">
                <b>{p.name}</b> {p.rx && <Badge c="am">يحتاج روشتة</Badge>}
                <div className="mu sm2">{[p.dose, p.form, p.ingredient].filter(Boolean).join(' · ')}</div>
                {(p.description || p.warnings) && <details><summary>التفاصيل</summary>
                  {p.description && <p><b>الاستخدام:</b> {p.description}</p>}{p.warnings && <p><b>تحذيرات:</b> {p.warnings}</p>}</details>}
              </div>
              <div className="pr"><b>{p.price} ج.م</b>
                {p.stock > 0 ? (p.rx ? <a className="go" href={'#/rx/new?ph=' + p.pharmacyId}>ارفع روشتة ◂</a> :
                  cart.items[p.id] ? <div className="qty"><button onClick={() => rem(p.id)}>−</button><span>{cart.items[p.id].qty}</span><button onClick={() => add(p)}>＋</button></div>
                    : <button className="btn sm" onClick={() => add(p)}>أضف للطلب</button>)
                  : <Badge c="rd">نفد</Badge>}</div>
            </div>
          ))}
        </div>
      ))}
      {list.length > 0 && <div className="cartbar"><span>{list.reduce((s, x) => s + x.qty, 0)} عنصر · <b>{total} ج.م</b> · {phs[cart.pid]?.name}</span><button className="btn g" onClick={startCheckout}>إتمام الطلب</button></div>}
      {co && <div className="mo" onClick={(e) => e.target === e.currentTarget && setCo(null)}><form className="card narrow" onSubmit={send}>
        <h2>إتمام الطلب</h2><p className="mu">من {phs[cart.pid].name} · الإجمالي <b>{total} ج.م</b> (الدفع عند الاستلام)</p>
        <Field label="رقم الموبايل" name="phone" type="tel" v={co.phone} on={(v) => setCo({ ...co, phone: v })} dir="ltr" />
        <Field label="عنوان التوصيل" name="address" v={co.address} on={(v) => setCo({ ...co, address: v })} />
        <button type="button" className="btn o sm" onClick={async () => { try { const p = await getPos(); setCo((c) => ({ ...c, dest: { lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6) } })); toast('تم تحديد موقع التوصيل ✓'); } catch { toast('اسمح بالوصول للموقع'); } }}><Icon n="pin" s={16} /> {co.dest ? 'تم تحديد موقع التوصيل ✓' : 'حدد موقع التوصيل (عشان تتابع المندوب)'}</button>
        <Field label="ملاحظات (اختياري)" name="note" type="textarea" v={co.note} on={(v) => setCo({ ...co, note: v })} />
        <div className="row g"><button className="btn g" style={{ flex: 1 }}>تأكيد الطلب</button><button type="button" className="btn o" onClick={() => setCo(null)}>إلغاء</button></div>
      </form></div>}
    </div>
  );
}
