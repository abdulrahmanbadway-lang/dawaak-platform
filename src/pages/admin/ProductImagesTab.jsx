import { useCallback, useEffect, useState } from 'react';
import { collection, doc, getDocs, limit, query, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { Badge, toast } from '../../ui.jsx';
import { productImage } from '../../lib/img.js';
import { norm } from '../../lib/text.js';
import { errMsg } from '../../lib/errors.js';
import { clearCatalogCache } from '../../lib/featured.js';

// صور المنتجات: ارفع صورة حقيقية للمنتج وهتتطبق على نفس المنتج في كل الصيدليات (الأدمن بس، والـ Rules بتسمح له يغيّر imageUrl و imgReal بس)
export default function ProductImages() {
  const [rows, setRows] = useState(null), [q, setQ] = useState(''), [onlyDemo, setOnlyDemo] = useState(false), [busy, setBusy] = useState(''), [rep, setRep] = useState(null);
  const load = useCallback(() => getDocs(query(collection(db, 'products'), limit(1600))).then((s) => {
    const m = new Map();
    s.docs.forEach((d) => { const p = d.data(), k = norm(p.name || ''); if (!k) return; const g = m.get(k) || { k, name: p.name, ids: [], img: '', real: true }; g.ids.push(d.id); if (!g.img) g.img = p.imageUrl || ''; if (!p.imgReal) g.real = false; m.set(k, g); });
    setRows([...m.values()].sort((a, b) => a.name.localeCompare(b.name, 'ar')));
  }).catch((e) => { toast('تعذر التحميل: ' + errMsg(e)); setRows([]); }), []);
  useEffect(() => { load(); }, [load]);
  const apply = async (g, file) => {
    const url = await productImage(file);
    for (let i = 0; i < g.ids.length; i += 20) { const b = writeBatch(db); g.ids.slice(i, i + 20).forEach((id) => b.update(doc(db, 'products', id), { imageUrl: url, imgReal: true })); await b.commit(); }
    clearCatalogCache();
    return url;
  };
  const one = async (g, file) => {
    if (!file) return; setBusy(g.k);
    try { const url = await apply(g, file); setRows((r) => r.map((x) => (x.k === g.k ? { ...x, img: url, real: true } : x))); toast('اتغيّرت صورة ' + g.name + ' في ' + g.ids.length + ' صيدلية ✓'); }
    catch (x) { toast('تعذر: ' + errMsg(x)); }
    setBusy('');
  };
  // رفع جماعي: اسم الملف = اسم المنتج (مثلاً "بنادول اكسترا.jpg")
  const bulk = async (files) => {
    const ok = [], no = []; setBusy('bulk');
    for (const f of files) {
      const n = norm(f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '));
      const g = rows.find((x) => x.k === n) || rows.find((x) => n.length >= 3 && (x.k.includes(n) || n.includes(x.k)));
      if (!g) { no.push(f.name); continue; }
      try { await apply(g, f); ok.push(f.name + ' ← ' + g.name); } catch (x) { no.push(f.name + ' (' + (x.message || x.code) + ')'); }
    }
    setRep({ ok, no }); setBusy(''); await load();
  };
  if (!rows) return <p className="mu">جاري التحميل…</p>;
  const realN = rows.filter((g) => g.real).length;
  const list = rows.filter((g) => (!q || g.k.includes(norm(q))) && (!onlyDemo || !g.real));
  return (
    <div className="adm-card">
      <h3>صور المنتجات: {realN} من {rows.length} بصورة حقيقية</h3>
      <p className="mu">ارفع صورة العبوة الحقيقية لكل منتج (يفضّل خلفية بيضاء وتصوير من الأمام). الصورة بتتطبق على المنتج ده في كل الصيدليات. الصورة بتتضغط تلقائي.</p>
      <div className="row g" style={{ flexWrap: 'wrap' }}>
        <input className="fi" placeholder="ابحث عن منتج…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 260 }} />
        <label className="chk"><input type="checkbox" checked={onlyDemo} onChange={(e) => setOnlyDemo(e.target.checked)} /> اللي لسه من غير صورة حقيقية</label>
        <label className="btn o" style={{ cursor: 'pointer' }}>{busy === 'bulk' ? 'جاري الرفع…' : 'رفع جماعي (اسم الملف = اسم المنتج)'}<input type="file" accept="image/*" multiple hidden disabled={!!busy} onChange={(e) => { const fs = [...e.target.files]; e.target.value = ''; bulk(fs); }} /></label>
      </div>
      {rep && <div className="card" style={{ margin: '10px 0' }}><b>اتطبّق {rep.ok.length} صورة</b>{rep.ok.map((x) => <div key={x} className="mu sm2">✓ {x}</div>)}{rep.no.length > 0 && <><b style={{ color: 'var(--rd,#c9544d)' }}>ما اتطابقش ({rep.no.length}): غيّر اسم الملف لاسم المنتج بالظبط</b>{rep.no.map((x) => <div key={x} className="mu sm2">✗ {x}</div>)}</>}</div>}
      <table className="adm-t"><thead><tr><th></th><th>المنتج</th><th>صيدليات</th><th>الصورة</th><th></th></tr></thead>
        <tbody>{list.map((g) => <tr key={g.k}>
          <td>{g.img ? <img src={g.img} alt="" width="44" height="44" style={{ objectFit: 'contain', borderRadius: 8, background: '#fff' }} /> : '—'}</td>
          <td><b>{g.name}</b></td><td>{g.ids.length}</td>
          <td>{g.real ? <Badge c="ok">حقيقية</Badge> : <Badge c="am">تجريبية</Badge>}</td>
          <td><label className="btn o sm" style={{ cursor: 'pointer' }}>{busy === g.k ? '…' : g.real ? 'استبدال' : 'رفع صورة'}<input type="file" accept="image/*" hidden disabled={!!busy} onChange={(e) => { one(g, e.target.files[0]); e.target.value = ''; }} /></label></td></tr>)}
          {!list.length && <tr><td colSpan="5" className="mu">مفيش نتائج.</td></tr>}</tbody></table>
    </div>
  );
}
