import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, documentId, getCountFromServer, getDoc, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { Badge, toast } from '../../ui.jsx';
import { PaginationBar, usePagination } from '../../lib/paginate.js';
import { Chips, Empty, Seg, TableSkel, askConfirm, ms } from './common.jsx';
import { errMsg } from '../../lib/errors.js';
import { clearCatalogCache } from '../../lib/featured.js';

// المستندات الرسمية للصيدلية (سجل تجاري / بطاقة ضريبية / رخصة): مراجعة قبل التوثيق
function PharmDocs({ id }) {
  const [d, setD] = useState(undefined), [zoom, setZoom] = useState('');
  useEffect(() => { getDoc(doc(db, 'pharmacyDocs', id)).then((s) => setD(s.exists() ? s.data() : null)).catch((e) => setD({ err: e.code || e.message })); }, [id]);
  const del = async () => { if (!(await askConfirm({ title: 'حذف المستندات نهائيًا؟', text: 'اعمل كده بعد ما تتأكد وتوثّق الصيدلية. مفيش رجوع.', ok: 'حذف', danger: true }))) return; try { await deleteDoc(doc(db, 'pharmacyDocs', id)); setD(null); toast('تم حذف المستندات ✓'); } catch (e) { toast('تعذر الحذف: ' + errMsg(e)); } };
  if (d === undefined) return <p className="mu sm2">جاري التحميل…</p>;
  if (d && d.err) return <p className="err">مش قادر أقرأ المستندات: {/permission/i.test(d.err) ? 'انشر قواعد Firestore الجديدة.' : d.err}</p>;
  if (!d) return <p className="err">الصيدلية ما رفعتش مستندات.</p>;
  return (
    <>
      <div className="docview">{[['commercial', 'السجل التجاري'], ['tax', 'البطاقة الضريبية'], ['license', 'رخصة الصيدلية']].map(([k, l]) => (
        <figure key={k} className={zoom === k ? 'zoom' : ''}><figcaption>{l}</figcaption><img src={d[k]} alt={l} onClick={() => setZoom(zoom === k ? '' : k)} /></figure>))}</div>
      <p className="mu sm2">اضغط على الصورة للتكبير. راجع إن الاسم والترخيص والعنوان في المستندات بيطابقوا بيانات الصيدلية قبل التوثيق.</p>
      <button className="btn sm o" onClick={del}>حذف المستندات بعد التوثيق</button>
    </>
  );
}

// عدّاد خفيف (aggregation) بدل تحميل المستندات نفسها
function useCount(make, deps) {
  const [n, setN] = useState(undefined);
  useEffect(() => { let on = true; getCountFromServer(make()).then((c) => on && setN(c.data().count)).catch(() => on && setN(null)); return () => { on = false; }; }, deps); // eslint-disable-line
  return n;
}

function PharmCard({ p, email, orders, act }) {
  const [openDocs, setOpenDocs] = useState(false);
  const nProd = useCount(() => query(collection(db, 'products'), where('pharmacyId', '==', p.id)), [p.id]);
  const nDocs = useCount(() => query(collection(db, 'pharmacyDocs'), where(documentId(), '==', p.id)), [p.id]);
  const nOrd = (orders || []).filter((o) => o.pharmacyId === p.id).length;
  const show = (v) => (v === undefined ? '…' : v === null ? '—' : v);
  const verify = async () => {
    if (!p.verified) {
      const noDocs = nDocs === 0;
      if (!(await askConfirm({ title: `توثيق ${p.name}؟`, text: (noDocs ? 'تنبيه: الصيدلية دي ما رفعتش مستندات رسمية.\n' : '') + 'هتظهر للمرضى كصيدلية موثّقة ويقدروا يطلبوا منها.', ok: 'توثيق', danger: noDocs }))) return;
      act(p, { verified: true }, `تم توثيق ${p.name} ✓`);
    } else {
      if (!(await askConfirm({ title: `إلغاء توثيق ${p.name}؟`, text: 'هترجع "في انتظار التوثيق".', ok: 'إلغاء التوثيق', danger: true }))) return;
      act(p, { verified: false }, `تم إلغاء توثيق ${p.name} ✓`);
    }
  };
  const suspend = async () => {
    const on = p.status !== 'suspended';
    if (!(await askConfirm(on ? { title: `إيقاف ${p.name}؟`, text: 'هتختفي من نتايج البحث والمتجر. صاحبها لسه يقدر يدخل لوحته.', ok: 'إيقاف', danger: true } : { title: `إعادة تفعيل ${p.name}؟`, ok: 'إعادة تفعيل' }))) return;
    act(p, { status: on ? 'suspended' : 'active' }, on ? `تم إيقاف ${p.name} ✓` : `تم تفعيل ${p.name} ✓`);
  };
  return (
    <div className="card adm-ph">
      <div className="row between wrap g">
        <div><h3>{p.name} {p.verified ? <Badge>موثّقة</Badge> : <Badge c="am">في انتظار التوثيق</Badge>} {p.status === 'suspended' && <Badge c="rd">موقوفة</Badge>}</h3>
          <p className="mu sm2">{p.governorate} · {p.address}</p>
          <p className="sm2">المسؤول: {p.ownerName || '—'} · الترخيص: <b dir="ltr">{p.license || '—'}</b> · <span dir="ltr">{p.phone || '—'}</span>{email ? <> · <span dir="ltr" className="mu">{email}</span></> : null}</p>
          <div className="adm-chips adm-mini"><span>المنتجات: <b>{show(nProd)}</b></span><span>الطلبات (آخر 200): <b>{nOrd}</b></span><span className={nDocs === 0 ? 'rd' : nDocs === 1 ? 'gr' : ''}>المستندات: <b>{nDocs === undefined ? '…' : nDocs === null ? '—' : nDocs ? 'مرفوعة' : 'مش مرفوعة'}</b></span></div></div>
        <div className="row g wrap">
          <button className={'btn sm' + (p.verified ? ' o' : ' g')} onClick={verify}>{p.verified ? 'إلغاء التوثيق' : 'توثيق'}</button>
          <button className="btn sm o" onClick={() => setOpenDocs(!openDocs)}>{openDocs ? 'إخفاء المستندات' : 'مراجعة المستندات'}</button>
          <button className="btn sm o" onClick={suspend}>{p.status === 'suspended' ? 'إعادة تفعيل' : 'إيقاف'}</button>
        </div>
      </div>
      {openDocs && <PharmDocs id={p.id} />}
    </div>
  );
}

export default function Pharmacies({ phs, setPhs, users, orders }) {
  const [q, setQ] = useState(''), [f, setF] = useState('');
  const dq = useDeferredValue(q);
  const act = async (p, patch, msg) => {
    try { await updateDoc(doc(db, 'pharmacies', p.id), patch); clearCatalogCache(); setPhs((l) => l.map((x) => (x.id === p.id ? { ...x, ...patch } : x))); toast(msg || 'تم ✓'); }
    catch (e) { toast('تعذر التنفيذ: ' + errMsg(e)); }
  };
  const emailOf = useMemo(() => Object.fromEntries((users || []).map((u) => [u.id, u.email])), [users]);
  const cnt = useMemo(() => { const l = phs || []; return { all: l.length, pending: l.filter((p) => !p.verified).length, ok: l.filter((p) => p.verified && p.status !== 'suspended').length, susp: l.filter((p) => p.status === 'suspended').length }; }, [phs]);
  const rows = useMemo(() => {
    const t = dq.trim().toLowerCase();
    return (phs || []).filter((p) => (!f || (f === 'pending' ? !p.verified : f === 'suspended' ? p.status === 'suspended' : p.verified && p.status !== 'suspended'))
      && (!t || [p.name, p.governorate, p.license, p.ownerName, emailOf[p.id]].join(' ').toLowerCase().includes(t)))
      .sort((a, b) => (!!a.verified - !!b.verified) || (ms(b.createdAt) || 0) - (ms(a.createdAt) || 0));
  }, [phs, f, dq, emailOf]);
  const pg = usePagination(rows, 10);
  return (
    <>
      <Chips items={[['الكل', cnt.all], ['في انتظار التوثيق', cnt.pending, cnt.pending ? 'am' : ''], ['موثّقة ونشطة', cnt.ok, 'gr'], ['موقوفة', cnt.susp, cnt.susp ? 'rd' : '']]} />
      <div className="row g wrap adm-bar">
        <input className="fi adm-q" placeholder="ابحث باسم الصيدلية أو المحافظة أو الترخيص…" aria-label="بحث في الصيدليات" value={q} onChange={(e) => setQ(e.target.value)} />
        <Seg v={f} on={setF} opts={[['', 'الكل'], ['pending', 'مستنية توثيق'], ['verified', 'موثّقة'], ['suspended', 'موقوفة']]} />
      </div>
      {!phs ? <TableSkel rows={4} /> : !rows.length ? <div className="card"><Empty>{q || f ? 'مفيش صيدليات بالفلاتر دي' : 'مفيش صيدليات'}</Empty></div> : pg.pageItems.map((p) => <PharmCard key={p.id} p={p} email={emailOf[p.id]} orders={orders} act={act} />)}
      <PaginationBar {...pg} />
      <p className="mu sm2">التوثيق والإيقاف بيتكتبوا فعليًا (والقواعد بتسمح للأدمن بتغيير الحقلين دول بس). الإيقاف بيخفي الصيدلية من نتايج البحث؛ مش بيمنع صاحبها من الدخول. أعداد المنتجات والمستندات بتتجاب بعدّاد خفيف من غير ما تتحمّل الصور.</p>
    </>
  );
}
