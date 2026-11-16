import { useDeferredValue, useMemo, useState } from 'react';
import { Badge } from '../../ui.jsx';
import { PaginationBar, usePagination } from '../../lib/paginate.js';
import { Chips, Empty, Modal, ST, ST_C, Seg, TableSkel, ago, csvText, download, dt, money, ms } from './common.jsx';

const RANGES = [['', 'كل الفترات'], ['today', 'النهارده'], ['7', 'آخر 7 أيام'], ['30', 'آخر 30 يوم']];

function Details({ o, now, onClose }) {
  const c = ms(o.createdAt), u = ms(o.updatedAt);
  const items = Array.isArray(o.items) ? o.items : [];
  return (
    <Modal title={`طلب ${o.id.slice(0, 6)}`} onClose={onClose}>
      <div className="adm-kv">
        <div><span>الحالة</span><Badge c={ST_C[o.status] || ''}>{ST[o.status] || o.status}</Badge></div>
        <div><span>المريض</span><b>{o.patientName || '—'}</b></div>
        <div><span>الموبايل</span><b dir="ltr">{o.phone || '—'}</b></div>
        <div><span>الصيدلية</span><b>{o.pharmacyName || '—'}</b></div>
        <div><span>المندوب</span><b>{o.courierName || '—'}</b></div>
        <div><span>وقت الطلب</span><b>{dt(c)} <small className="mu">({ago(c, now)})</small></b></div>
        {u && u !== c && <div><span>آخر تحديث</span><b>{dt(u)}</b></div>}
        {o.source === 'rx' && <div><span>المصدر</span><Badge c="am">من روشتة</Badge></div>}
      </div>
      <p className="sm2"><span className="mu">العنوان: </span>{o.address || '—'}{o.dest && o.dest.lat != null ? <> · <a href={`https://www.google.com/maps?q=${o.dest.lat},${o.dest.lng}`} target="_blank" rel="noreferrer">الموقع على الخريطة</a></> : null}</p>
      {o.note ? <p className="sm2"><span className="mu">ملاحظة: </span>{o.note}</p> : null}
      <div className="adm-tw card"><table className="adm-t" style={{ minWidth: 0 }}><thead><tr><th>الصنف</th><th>السعر</th><th>الكمية</th><th>الإجمالي</th></tr></thead>
        <tbody>{items.map((x, i) => <tr key={i}><td><b>{x.name}</b> {x.dose && <span className="mu">{x.dose}</span>}</td><td>{money(x.price)}</td><td>{x.qty}</td><td>{money((x.price || 0) * (x.qty || 0))}</td></tr>)}
          {!items.length && <tr><td colSpan="4" className="mu">مفيش أصناف مسجّلة</td></tr>}</tbody>
        <tfoot><tr><td colSpan="3"><b>الإجمالي</b></td><td><b>{money(o.total)}</b></td></tr></tfoot></table></div>
    </Modal>
  );
}

export default function Orders({ orders, now }) {
  const [q, setQ] = useState(''), [st, setSt] = useState(''), [rg, setRg] = useState(''), [open, setOpen] = useState(null);
  const dq = useDeferredValue(q);
  const cnt = useMemo(() => { const c = {}; (orders || []).forEach((o) => { c[o.status] = (c[o.status] || 0) + 1; }); return c; }, [orders]);
  const rows = useMemo(() => {
    const t = dq.trim().toLowerCase();
    const d0 = new Date(now); d0.setHours(0, 0, 0, 0);
    const from = rg === 'today' ? d0.getTime() : rg ? now - (+rg) * 86400000 : 0;
    return (orders || []).filter((o) => (!st || o.status === st) && (!from || (ms(o.createdAt) || 0) >= from)
      && (!t || [o.patientName, o.pharmacyName, o.phone, o.id, o.courierName].join(' ').toLowerCase().includes(t)));
  }, [orders, st, rg, dq, now]);
  const pg = usePagination(rows, 25);
  const sum = rows.reduce((s, o) => s + (o.status === 'done' ? o.total || 0 : 0), 0);
  const exp = () => download('dawaak-orders.csv', csvText([['رقم', 'المريض', 'الموبايل', 'الصيدلية', 'الإجمالي', 'الحالة', 'المندوب', 'التاريخ'], ...rows.map((o) => [o.id, o.patientName, o.phone, o.pharmacyName, o.total, ST[o.status] || o.status, o.courierName || '', dt(ms(o.createdAt))])]));
  return (
    <>
      <Chips items={[['الكل', (orders || []).length], ['جديد', cnt.new || 0, cnt.new ? 'am' : ''], ['قيد التنفيذ', (cnt.preparing || 0) + (cnt.out || 0)], ['تم التسليم', cnt.done || 0, 'gr'], ['ملغي', cnt.cancelled || 0, cnt.cancelled ? 'rd' : '']]} />
      <div className="row g wrap adm-bar">
        <input className="fi adm-q" placeholder="ابحث باسم المريض أو الصيدلية أو الموبايل أو المندوب…" aria-label="بحث في الطلبات" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="fi sel" aria-label="الحالة" value={st} onChange={(e) => setSt(e.target.value)}><option value="">كل الحالات</option>{Object.entries(ST).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <Seg v={rg} on={setRg} opts={RANGES} />
        <button className="btn o sm" onClick={exp}>تصدير CSV ({rows.length})</button>
      </div>
      {!orders ? <TableSkel /> : !rows.length ? <div className="card"><Empty>{q || st || rg ? 'مفيش طلبات بالفلاتر دي' : 'مفيش طلبات لسه'}</Empty></div> : (
        <div className="card adm-tw">
          <table className="adm-t"><thead><tr><th>#</th><th>المريض</th><th>الصيدلية</th><th>الإجمالي</th><th>الحالة</th><th>المندوب</th><th>وقت الطلب</th><th></th></tr></thead>
            <tbody>{pg.pageItems.map((o) => <tr key={o.id} className={o.status === 'new' ? 'adm-hl' : ''}><td dir="ltr" className="mu">{o.id.slice(0, 6)}</td><td><b>{o.patientName}</b></td><td>{o.pharmacyName}</td><td>{money(o.total)}</td>
              <td><Badge c={ST_C[o.status] || ''}>{ST[o.status] || o.status}</Badge></td><td>{o.courierName || '—'}</td><td className="mu">{dt(ms(o.createdAt))} <small>({ago(ms(o.createdAt), now)})</small></td>
              <td><button className="btn o sm" onClick={() => setOpen(o)}>التفاصيل</button></td></tr>)}</tbody></table>
        </div>)}
      <PaginationBar {...pg} />
      {rows.length > 0 && <p className="mu sm2">مبيعات الطلبات المسلّمة في النتيجة الحالية: <b>{money(sum)}</b></p>}
      {open && <Details o={orders.find((x) => x.id === open.id) || open} now={now} onClose={() => setOpen(null)} />}
      <p className="mu sm2">بيعرض آخر 200 طلب بتحديث مباشر (الطلبات الجديدة بتظهر لوحدها وبتتلوّن). الروشتات (صور طبية) مش بتظهر هنا عن قصد.</p>
    </>
  );
}
