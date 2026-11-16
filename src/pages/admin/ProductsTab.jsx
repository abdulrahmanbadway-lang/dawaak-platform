import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, getDocs, limit, query } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { Badge, toast } from '../../ui.jsx';
import { Icon } from '../../icons.jsx';
import { ErrorState } from '../../skeleton.jsx';
import { isRealImage, productImageUrl } from '../../lib/img.js';
import { PaginationBar, usePagination } from '../../lib/paginate.js';
import { errMsg } from '../../lib/errors.js';
import { clearCatalogCache } from '../../lib/featured.js';
import { Chips, Empty, TableSkel, askConfirm, money } from './common.jsx';

const LIM = 500;

export default function ProductsAdmin({ phs }) {
  const [rows, setRows] = useState(null), [err, setErr] = useState(null);
  const [q, setQ] = useState(''), [ph, setPh] = useState(''), [stk, setStk] = useState(''), [pic, setPic] = useState(''), [rx, setRx] = useState('');
  const dq = useDeferredValue(q);
  const load = useCallback(async () => {
    setErr(null); setRows(null);
    try { const s = await getDocs(query(collection(db, 'products'), limit(LIM))); setRows(s.docs.map((d) => ({ id: d.id, ...d.data() }))); }
    catch (e) { setErr(e); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const nameOf = useCallback((id) => (phs || []).find((p) => p.id === id)?.name || id.slice(0, 6), [phs]);
  const del = async (p) => {
    if (!(await askConfirm({ title: `حذف "${p.name}"؟`, text: `من ${nameOf(p.pharmacyId)}. الحذف نهائي.`, ok: 'حذف المنتج', danger: true }))) return;
    try { await deleteDoc(doc(db, 'products', p.id)); clearCatalogCache(); setRows((l) => l.filter((x) => x.id !== p.id)); toast(`تم حذف ${p.name} ✓`); }
    catch (e) { toast('تعذر الحذف: ' + errMsg(e)); }
  };
  const stat = useMemo(() => {
    const l = rows || [];
    return { all: l.length, noPic: l.filter((p) => !isRealImage(p.imageUrl)).length, out: l.filter((p) => !(p.stock > 0)).length, low: l.filter((p) => p.stock > 0 && p.stock < 5).length };
  }, [rows]);
  const list = useMemo(() => {
    const t = dq.trim().toLowerCase();
    return (rows || []).filter((p) => (!ph || p.pharmacyId === ph)
      && (!stk || (stk === 'out' ? !(p.stock > 0) : stk === 'low' ? p.stock > 0 && p.stock < 5 : p.stock >= 5))
      && (!pic || (pic === 'none' ? !isRealImage(p.imageUrl) : isRealImage(p.imageUrl)))
      && (!rx || (rx === 'rx' ? p.rx === true : p.rx !== true))
      && (!t || [p.name, p.ingredient, p.brand].join(' ').toLowerCase().includes(t)))
      .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ar'));
  }, [rows, ph, stk, pic, rx, dq]);
  const pg = usePagination(list, 25);
  const filtered = q || ph || stk || pic || rx;
  const reset = () => { setQ(''); setPh(''); setStk(''); setPic(''); setRx(''); };
  if (err) return <ErrorState error={err} onRetry={load} />;
  return (
    <>
      <Chips items={[['المحمّل', stat.all], ['نفد', stat.out, stat.out ? 'rd' : ''], ['مخزون قليل (<5)', stat.low, stat.low ? 'am' : ''], ['بدون صورة حقيقية', stat.noPic, stat.noPic ? 'am' : '']]} />
      {rows && stat.noPic > 0 && (
        <div className="adm-alerts"><span><Icon n="camera" s={16} />{stat.noPic} منتج من {stat.all} من غير صورة حقيقية (بيظهر مكانها رسم افتراضي للقسم). ارفع الصور من "المحتوى ← صور المنتجات".</span>
          {pic !== 'none' && <button onClick={() => setPic('none')}>اعرضهم<small>←</small></button>}</div>)}
      <div className="row g wrap adm-bar">
        <input className="fi adm-q" placeholder="ابحث باسم المنتج أو المادة الفعالة…" aria-label="بحث في المنتجات" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="fi sel" aria-label="الصيدلية" value={ph} onChange={(e) => setPh(e.target.value)}><option value="">كل الصيدليات</option>{(phs || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <select className="fi sel" aria-label="المخزون" value={stk} onChange={(e) => setStk(e.target.value)}><option value="">كل المخزون</option><option value="out">نفد</option><option value="low">قليل (أقل من 5)</option><option value="ok">متوفر</option></select>
        <select className="fi sel" aria-label="الصورة" value={pic} onChange={(e) => setPic(e.target.value)}><option value="">كل الصور</option><option value="none">بدون صورة حقيقية</option><option value="real">بصورة حقيقية</option></select>
        <select className="fi sel" aria-label="النوع" value={rx} onChange={(e) => setRx(e.target.value)}><option value="">كل الأنواع</option><option value="rx">بروشتة</option><option value="otc">بدون روشتة</option></select>
        <span className="mu sm2">{rows ? list.length + ' منتج' : ''}</span>
      </div>
      {!rows ? <TableSkel /> : !list.length ? <div className="card"><Empty>{filtered ? <>مفيش منتجات بالفلاتر دي. <button className="btn o sm" onClick={reset}>مسح الفلاتر</button></> : 'مفيش منتجات'}</Empty></div> : (
        <div className="card adm-tw">
          <table className="adm-t"><thead><tr><th></th><th>المنتج</th><th>الصيدلية</th><th>التفاصيل</th><th>السعر</th><th>المخزون</th><th>صورة</th><th></th></tr></thead>
            <tbody>{pg.pageItems.map((p) => <tr key={p.id}>
              <td><span className="adm-th"><img src={productImageUrl(p)} alt="" loading="lazy" /></span></td>
              <td><b>{p.name}</b> {p.rx && <Badge c="am">روشتة</Badge>}</td><td>{nameOf(p.pharmacyId)}</td>
              <td className="mu">{[p.dose, p.form, p.ingredient].filter(Boolean).join(' · ') || '—'}</td><td>{money(p.price)}</td>
              <td><Badge c={p.stock > 0 ? (p.stock < 5 ? 'am' : '') : 'rd'}>{p.stock > 0 ? p.stock : 'نفد'}</Badge></td>
              <td>{isRealImage(p.imageUrl) ? <span className="mu">حقيقية</span> : <Badge c="am">مفيش</Badge>}</td>
              <td><button className="btn o sm" onClick={() => del(p)}>حذف</button></td></tr>)}</tbody></table>
        </div>)}
      <PaginationBar {...pg} />
      <p className="mu sm2">بيحمّل أول {LIM} منتج{rows && rows.length >= LIM ? ' (وصلنا للحد — فيه منتجات تانية مش ظاهرة)' : ''}. الحذف نهائي، والقواعد بتسمح للأدمن بحذف أي منتج ولصاحب الصيدلية بحذف منتجه بس.</p>
    </>
  );
}
