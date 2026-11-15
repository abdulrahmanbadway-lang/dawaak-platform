import { useEffect, useState } from 'react';
import { deleteDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { Badge, toast } from '../../ui.jsx';
import { Empty, ms } from './common.jsx';

// المستندات الرسمية للصيدلية (سجل تجاري / بطاقة ضريبية / رخصة): مراجعة قبل التوثيق
function PharmDocs({ id }) {
  const [d, setD] = useState(undefined), [zoom, setZoom] = useState('');
  useEffect(() => { getDoc(doc(db, 'pharmacyDocs', id)).then((s) => setD(s.exists() ? s.data() : null)).catch((e) => setD({ err: e.code || e.message })); }, [id]);
  const del = async () => { if (!window.confirm('حذف المستندات نهائياً؟ اعمل كده بعد ما تتأكد وتوثّق الصيدلية.')) return; try { await deleteDoc(doc(db, 'pharmacyDocs', id)); setD(null); toast('تم الحذف ✓'); } catch (e) { toast('تعذر الحذف: ' + (e.code || e.message)); } };
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

export default function Pharmacies({ phs, setPhs, users }) {
  const [openDocs, setOpenDocs] = useState('');
  const [q, setQ] = useState('');
  const act = async (p, patch) => {
    try { await updateDoc(doc(db, 'pharmacies', p.id), patch); setPhs((l) => l.map((x) => (x.id === p.id ? { ...x, ...patch } : x))); toast('تم ✓'); }
    catch (e) { toast('تعذر التنفيذ: ' + (e.code || e.message)); }
  };
  const email = (id) => (users || []).find((u) => u.id === id)?.email;
  const rows = (phs || []).filter((p) => !q || [p.name, p.governorate, p.license, p.ownerName].join(' ').toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (a.verified - b.verified) || (ms(b.createdAt) || 0) - (ms(a.createdAt) || 0));
  return (
    <>
      <div className="adm-bar"><input className="fi adm-q" placeholder="ابحث باسم الصيدلية أو المحافظة أو الترخيص…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {!phs ? <Empty>جاري التحميل…</Empty> : !rows.length ? <Empty>مفيش صيدليات</Empty> : rows.map((p) => (
        <div className="card adm-ph" key={p.id}>
          <div className="row between wrap g">
            <div><h3>{p.name} {p.verified ? <Badge>موثّقة</Badge> : <Badge c="am">في انتظار التوثيق</Badge>} {p.status === 'suspended' && <Badge c="rd">موقوفة</Badge>}</h3>
              <p className="mu sm2">{p.governorate} · {p.address}</p>
              <p className="sm2">المسؤول: {p.ownerName || '—'} · الترخيص: <b dir="ltr">{p.license || '—'}</b> · <span dir="ltr">{p.phone || '—'}</span>{email(p.id) ? <> · <span dir="ltr" className="mu">{email(p.id)}</span></> : null}</p></div>
            <div className="row g wrap">
              <button className={'btn sm' + (p.verified ? ' o' : ' g')} onClick={() => act(p, { verified: !p.verified })}>{p.verified ? 'إلغاء التوثيق' : 'توثيق'}</button>
              <button className="btn sm o" onClick={() => setOpenDocs(openDocs === p.id ? '' : p.id)}>{openDocs === p.id ? 'إخفاء المستندات' : 'المستندات'}</button>
              <button className="btn sm o" onClick={() => act(p, { status: p.status === 'suspended' ? 'active' : 'suspended' })}>{p.status === 'suspended' ? 'إعادة تفعيل' : 'إيقاف'}</button>
            </div>
          </div>
          {openDocs === p.id && <PharmDocs id={p.id} />}
        </div>))}
      <p className="mu sm2">التوثيق والإيقاف بيتكتبوا فعليًا (والقواعد بتسمح للأدمن بتغيير الحقلين دول بس). الإيقاف بيخفي الصيدلية من نتايج البحث؛ مش بيمنع صاحبها من الدخول.</p>
    </>
  );
}
