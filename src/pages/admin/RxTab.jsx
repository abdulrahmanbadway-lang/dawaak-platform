import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { collection, getCountFromServer, getDocs, limit, orderBy, query, startAfter, where } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { RX_LABEL, RX_TONE } from '../../lib/status.js';
import { Badge } from '../../ui.jsx';
import { ErrorState } from '../../skeleton.jsx';
import { PaginationBar, usePagination } from '../../lib/paginate.js';
import { Chips, Empty, Modal, TableSkel, ago, dt, money, ms } from './common.jsx';

const PAGE = 40;

function Details({ r, now, onClose }) {
  const items = Array.isArray(r.quote?.items) ? r.quote.items : [];
  return (
    <Modal title={`روشتة ${r.id.slice(0, 6)}`} onClose={onClose}>
      <div className="adm-kv">
        <div><span>الحالة</span><Badge c={RX_TONE[r.status] || ''}>{RX_LABEL[r.status] || r.status}</Badge></div>
        <div><span>المريض</span><b>{r.patientName || '—'}</b></div>
        <div><span>الصيدلية</span><b>{r.pharmacyName || '—'}</b></div>
        <div><span>عدد الصور</span><b>{r.nImages}</b></div>
        <div><span>وقت الرفع</span><b>{dt(ms(r.createdAt))} <small className="mu">({ago(ms(r.createdAt), now)})</small></b></div>
      </div>
      {items.length > 0 && <div className="adm-tw card"><table className="adm-t" style={{ minWidth: 0 }}><thead><tr><th>الصنف</th><th>السعر</th><th>الكمية</th></tr></thead>
        <tbody>{items.map((x, i) => <tr key={i}><td><b>{x.name}</b></td><td>{money(x.price)}</td><td>{x.qty}</td></tr>)}</tbody>
        <tfoot><tr><td colSpan="2"><b>إجمالي عرض السعر</b></td><td><b>{money(r.quote?.total)}</b></td></tr></tfoot></table></div>}
      {r.quote?.note ? <p className="sm2"><span className="mu">ملاحظة الصيدلي: </span>{r.quote.note}</p> : null}
      <p className="mu sm2">صور الروشتة مش بتتعرض هنا لخصوصية المريض.</p>
    </Modal>
  );
}

export default function RxAdmin({ now, setRxNew }) {
  const [rows, setRows] = useState(null), [err, setErr] = useState(null), [last, setLast] = useState(null), [more, setMore] = useState(false), [busy, setBusy] = useState(false);
  const [st, setSt] = useState(''), [q, setQ] = useState(''), [open, setOpen] = useState(null);
  const dq = useDeferredValue(q);
  const strip = (d) => { const { images, ...r } = d.data(); return { id: d.id, ...r, nImages: Array.isArray(images) ? images.length : 0 }; };
  const load = useCallback(async (next) => {
    setErr(null); setBusy(true);
    try {
      const base = [collection(db, 'prescriptions'), orderBy('createdAt', 'desc'), ...(next && last ? [startAfter(last)] : []), limit(PAGE)];
      const s = await getDocs(query(...base));
      const add = s.docs.map(strip);
      setRows((l) => (next ? [...(l || []), ...add] : add)); setLast(s.docs[s.docs.length - 1] || null); setMore(s.docs.length === PAGE);
    } catch (e) { setErr(e); }
    setBusy(false);
  }, [last]);
  useEffect(() => { load(false); }, []); // eslint-disable-line
  // العدّاد في بدج التبويب بيتحدّث من السيرفر لما التبويب يتفتح
  useEffect(() => { if (setRxNew) getCountFromServer(query(collection(db, 'prescriptions'), where('status', '==', 'pending'))).then((c) => setRxNew(c.data().count)).catch(() => {}); }, [setRxNew]);
  const cnt = useMemo(() => { const c = {}; (rows || []).forEach((r) => { c[r.status] = (c[r.status] || 0) + 1; }); return c; }, [rows]);
  const list = useMemo(() => {
    const t = dq.trim().toLowerCase();
    return (rows || []).filter((r) => (!st || r.status === st) && (!t || [r.patientName, r.pharmacyName, r.id].join(' ').toLowerCase().includes(t)));
  }, [rows, st, dq]);
  const pg = usePagination(list, 25);
  if (err && !rows) return <ErrorState error={err} onRetry={() => load(false)} />;
  return (
    <>
      <Chips items={[['المحمّل', (rows || []).length], ['بانتظار رد', (cnt.pending || 0) + (cnt.need_info || 0), (cnt.pending || 0) ? 'am' : ''], ['مرد عليها', cnt.quoted || 0], ['اتحوّلت لطلب', cnt.ordered || 0, 'gr'], ['غير متاحة/ملغية', (cnt.unavailable || 0) + (cnt.cancelled || 0)]]} />
      <div className="row g wrap adm-bar">
        <input className="fi adm-q" placeholder="ابحث باسم المريض أو الصيدلية…" aria-label="بحث في الروشتات" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="fi sel" aria-label="الحالة" value={st} onChange={(e) => setSt(e.target.value)}><option value="">كل الحالات</option>{Object.entries(RX_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <span className="mu sm2">{rows ? list.length + ' روشتة' : ''}</span>
      </div>
      {!rows ? <TableSkel /> : !list.length ? <div className="card"><Empty>{q || st ? 'مفيش روشتات بالفلاتر دي' : 'مفيش روشتات لسه'}</Empty></div> : (
        <div className="card adm-tw">
          <table className="adm-t"><thead><tr><th>#</th><th>المريض</th><th>الصيدلية</th><th>الحالة</th><th>الصور</th><th>عرض السعر</th><th>وقت الرفع</th><th></th></tr></thead>
            <tbody>{pg.pageItems.map((r) => <tr key={r.id} className={r.status === 'pending' ? 'adm-hl' : ''}><td dir="ltr" className="mu">{r.id.slice(0, 6)}</td><td><b>{r.patientName}</b></td><td>{r.pharmacyName}</td>
              <td><Badge c={RX_TONE[r.status] || ''}>{RX_LABEL[r.status] || r.status}</Badge></td><td>{r.nImages}</td>
              <td>{r.quote?.total ? money(r.quote.total) : '—'}</td><td className="mu">{dt(ms(r.createdAt))} <small>({ago(ms(r.createdAt), now)})</small></td>
              <td><button className="btn o sm" onClick={() => setOpen(r)}>التفاصيل</button></td></tr>)}</tbody></table>
        </div>)}
      <PaginationBar {...pg} />
      {err && <p className="err">{String(err.message || err)}</p>}
      {more && <div className="row g"><button className="btn o sm" disabled={busy} onClick={() => load(true)}>{busy ? 'جاري التحميل…' : 'تحميل روشتات أقدم'}</button></div>}
      {open && <Details r={open} now={now} onClose={() => setOpen(null)} />}
      <p className="mu sm2">بيحمّل {PAGE} روشتة في المرة (بدون عرض الصور عن قصد). تنبيه: قواعد Firestore بتسمح للأدمن بقراءة مستند الروشتة كامل (بما فيه الصور)، فاعتبر الصلاحية دي حساسة وما تديهاش لأي حد غيرك.</p>
    </>
  );
}
