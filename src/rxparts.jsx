import { useEffect, useRef, useState } from 'react';
import { collection, query, orderBy, onSnapshot, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';
import { RX_OPEN, ms } from './lib/status.js';
import { toast } from './ui.jsx';

export const fmtTime = (t) => { const v = ms(t); return v ? new Date(v).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }) : ''; };
const money = (n) => +(+n).toFixed(2);

// صور الروشتة: مصغّرات + عرض مكبّر
export function Thumbs({ images = [] }) {
  const [z, setZ] = useState(null);
  const go = (d) => setZ((z + d + images.length) % images.length);
  return (
    <>
      <div className="thumbs">{images.map((s, i) => <button type="button" key={i} className="thumb" onClick={() => setZ(i)} aria-label={'عرض صورة الروشتة ' + (i + 1)}><img src={s} alt="" /></button>)}</div>
      {z != null && <div className="mo" onClick={() => setZ(null)}><div className="zoom" onClick={(e) => e.stopPropagation()}>
        <div className="row between"><b>صورة {z + 1} من {images.length}</b><button type="button" className="btn o sm" onClick={() => setZ(null)}>إغلاق ✕</button></div>
        <img src={images[z]} alt="" />
        {images.length > 1 && <div className="row g"><button type="button" className="btn o sm" onClick={() => go(-1)}>السابقة</button><button type="button" className="btn o sm" onClick={() => go(1)}>التالية</button></div>}
      </div></div>}
    </>
  );
}

// عرض سعر الصيدلي
export function QuoteView({ quote }) {
  return (
    <div className="qt">
      <table><thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th></tr></thead><tbody>
        {quote.items.map((i, k) => <tr key={k}><td>{i.name}{i.dose && <small className="mu"> ({i.dose})</small>}</td><td>{i.qty}</td><td>{money(i.price * i.qty)} ج.م</td></tr>)}
      </tbody></table>
      <div className="row between wrap"><span className="mu sm2">{quote.note}</span><b className="dist">الإجمالي {quote.total} ج.م</b></div>
    </div>
  );
}

// محادثة المريض والصيدلي على الروشتة (لحظية)
export function Chat({ rx, role, uid }) {
  const [msgs, setMsgs] = useState([]), [t, setT] = useState(''), [busy, setBusy] = useState(false);
  const end = useRef(null);
  const open = RX_OPEN.includes(rx.status);
  useEffect(() => onSnapshot(query(collection(db, 'prescriptions', rx.id, 'messages'), orderBy('createdAt')),
    (s) => setMsgs(s.docs.map((d) => ({ id: d.id, ...d.data() }))), (e) => toast('تعذر تحميل المحادثة: ' + e.message)), [rx.id]);
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [msgs.length]);
  const send = async (e) => {
    e.preventDefault();
    const text = t.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const b = writeBatch(db);
      b.set(doc(collection(db, 'prescriptions', rx.id, 'messages')), { senderId: uid, role, text, createdAt: serverTimestamp() });
      // لما المريض يرد على طلب التوضيح الروشتة ترجع للصيدلي كـ "بانتظار الرد"
      if (role === 'patient' && rx.status === 'need_info') b.update(doc(db, 'prescriptions', rx.id), { status: 'pending', updatedAt: serverTimestamp() });
      await b.commit(); setT('');
    } catch (x) { toast('تعذر الإرسال: ' + x.message); }
    setBusy(false);
  };
  return (
    <div className="chat">
      <div className="chm">
        {!msgs.length && <p className="mu sm2 c">مفيش رسائل لسه. {open ? 'اكتب أول رسالة.' : ''}</p>}
        {msgs.map((m) => <div key={m.id} className={'msg' + (m.senderId === uid ? ' me' : '')}>{m.text}<small>{m.role === 'pharmacy' ? 'الصيدلي' : 'المريض'} · {fmtTime(m.createdAt)}</small></div>)}
        <div ref={end} />
      </div>
      {open ? <form className="chf" onSubmit={send}><input className="fi" value={t} maxLength={1000} onChange={(e) => setT(e.target.value)} placeholder="اكتب رسالتك…" /><button className="btn sm" disabled={busy || !t.trim()}>إرسال</button></form>
        : <p className="mu sm2 c chf">المحادثة مقفولة لأن الروشتة خلصت.</p>}
    </div>
  );
}
