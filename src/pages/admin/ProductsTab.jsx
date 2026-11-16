import { useCallback, useEffect, useState } from 'react';
import { collection, deleteDoc, doc, getDocs, limit, query } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { Badge, toast } from '../../ui.jsx';
import { Icon } from '../../icons.jsx';
import { Empty, money } from './common.jsx';
import { errMsg } from '../../lib/errors.js';
import { clearCatalogCache } from '../../lib/featured.js';

export default function ProductsAdmin({ phs }) {
  const [rows, setRows] = useState(null), [q, setQ] = useState(''), [ph, setPh] = useState('');
  const load = useCallback(async () => {
    const s = await getDocs(query(collection(db, 'products'), limit(500)));
    setRows(s.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, []);
  useEffect(() => { load().catch((e) => toast('تعذر تحميل المنتجات: ' + errMsg(e))); }, [load]);
  const nameOf = (id) => (phs || []).find((p) => p.id === id)?.name || id.slice(0, 6);
  const del = async (p) => {
    if (!confirm(`حذف "${p.name}" من ${nameOf(p.pharmacyId)}؟\nالحذف نهائي.`)) return;
    try { await deleteDoc(doc(db, 'products', p.id)); clearCatalogCache(); setRows((l) => l.filter((x) => x.id !== p.id)); toast('تم الحذف ✓'); }
    catch (e) { toast('تعذر الحذف: ' + errMsg(e)); }
  };
  const list = (rows || []).filter((p) => (!ph || p.pharmacyId === ph) && (!q || [p.name, p.ingredient].join(' ').toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ar'));
  return (
    <>
      <div className="row g wrap adm-bar">
        <input className="fi adm-q" placeholder="ابحث باسم المنتج أو المادة الفعالة…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="fi sel" value={ph} onChange={(e) => setPh(e.target.value)}><option value="">كل الصيدليات</option>{(phs || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <span className="mu sm2">{rows ? list.length + ' منتج' : ''}</span>
      </div>
      <div className="card adm-tw">{!rows ? <Empty>جاري التحميل…</Empty> : !list.length ? <Empty>مفيش منتجات</Empty> :
        <table className="adm-t"><thead><tr><th></th><th>المنتج</th><th>الصيدلية</th><th>التفاصيل</th><th>السعر</th><th>المخزون</th><th>صورة</th><th></th></tr></thead>
          <tbody>{list.map((p) => <tr key={p.id}>
            <td><span className="adm-th">{p.imageUrl ? <img src={p.imageUrl} alt="" loading="lazy" /> : <Icon n="pill" s={20} />}</span></td>
            <td><b>{p.name}</b> {p.rx && <Badge c="am">روشتة</Badge>}</td><td>{nameOf(p.pharmacyId)}</td>
            <td className="mu">{[p.dose, p.form, p.ingredient].filter(Boolean).join(' · ') || '—'}</td><td>{money(p.price)}</td>
            <td><Badge c={p.stock > 0 ? (p.stock < 5 ? 'am' : '') : 'rd'}>{p.stock > 0 ? p.stock : 'نفد'}</Badge></td>
            <td className="mu">{p.imageUrl ? 'فيه' : 'مفيش'}</td>
            <td><button className="btn o sm" onClick={() => del(p)}>حذف</button></td></tr>)}</tbody></table>}</div>
      <p className="mu sm2">بيعرض أول 500 منتج. الحذف نهائي، والقواعد بتسمح للأدمن بحذف أي منتج ولصاحب الصيدلية بحذف منتجه بس.</p>
    </>
  );
}
