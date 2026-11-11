import { useEffect, useRef, useState } from 'react';
import { collection, query, orderBy, onSnapshot, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase.js';
import { RX_OPEN, ms } from './lib/status.js';
import { toast } from './ui.jsx';
import { trs, lcl, tdata } from './lib/i18n.js';

export const fmtTime = (t) => { const v = ms(t); return v ? new Date(v).toLocaleString(lcl(), { dateStyle: 'medium', timeStyle: 'short' }) : ''; };
const money = (n) => +(+n).toFixed(2);

// صور الروشتة: مصغّرات + عرض مكبّر
export function Thumbs({ images = [] }) {
  const [z, setZ] = useState(null);
  const go = (d) => setZ((z + d + images.length) % images.length);
  return (
    <>
      <div className="thumbs">{images.map((s, i) => <button type="button" key={i} className="thumb" onClick={() => setZ(i)} aria-label={trs("عرض صورة الروشتة ") + (i + 1)}><img src={s} alt="" /></button>)}</div>
      {z != null && <div className="mo" onClick={() => setZ(null)}><div className="zoom" onClick={(e) => e.stopPropagation()}>
        <div className="row between"><b>{trs("صورة {0} من {1}", [z + 1, images.length])}</b><button type="button" className="btn o sm" onClick={() => setZ(null)}>{trs("إغلاق ✕")}</button></div>
        <img src={images[z]} alt="" />
        {images.length > 1 && <div className="row g"><button type="button" className="btn o sm" onClick={() => go(-1)}>{trs("السابقة")}</button><button type="button" className="btn o sm" onClick={() => go(1)}>{trs("التالية")}</button></div>}
      </div></div>}
    </>
  );
}

// عرض سعر الصيدلي
export function QuoteView({ quote }) {
  return (
    <div className="qt">
      <table><thead><tr><th>{trs("الصنف")}</th><th>{trs("الكمية")}</th><th>{trs("السعر")}</th></tr></thead><tbody>
        {quote.items.map((i, k) => <tr key={k}><td>{i.name}{i.dose && <small className="mu"> ({tdata(i.dose)})</small>}</td><td>{i.qty}</td><td>{money(i.price * i.qty)} {trs("ج.م")}</td></tr>)}
      </tbody></table>
      <div className="row between wrap"><span className="mu sm2">{quote.note}</span><b className="dist">{trs("الإجمالي")}{" "}{quote.total} {trs("ج.م")}</b></div>
    </div>
  );
}

// محادثة المريض والصيدلي على الروشتة (لحظية)
export function Chat({ rx, role, uid }) {
  const [msgs, setMsgs] = useState([]), [t, setT] = useState(''), [busy, setBusy] = useState(false);
  const end = useRef(null);
  const open = RX_OPEN.includes(rx.status);
  useEffect(() => onSnapshot(query(collection(db, 'prescriptions', rx.id, 'messages'), orderBy('createdAt')),
    (s) => setMsgs(s.docs.map((d) => ({ id: d.id, ...d.data() }))), (e) => toast(trs("تعذر تحميل المحادثة: ") + e.message)), [rx.id]);
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
    } catch (x) { toast(trs("تعذر الإرسال: ") + x.message); }
    setBusy(false);
  };
  return (
    <div className="chat">
      <div className="chm">
        {!msgs.length && <p className="mu sm2 c">{trs("مفيش رسائل لسه.")}{" "}{open ? trs("اكتب أول رسالة.") : ''}</p>}
        {msgs.map((m) => <div key={m.id} className={'msg' + (m.senderId === uid ? ' me' : '')}>{m.text}<small>{m.role === 'pharmacy' ? trs("الصيدلي") : trs("المريض")} · {fmtTime(m.createdAt)}</small></div>)}
        <div ref={end} />
      </div>
      {open ? <form className="chf" onSubmit={send}><input className="fi" value={t} maxLength={1000} onChange={(e) => setT(e.target.value)} placeholder={trs("اكتب رسالتك…")} /><button className="btn sm" disabled={busy || !t.trim()}>{trs("إرسال")}</button></form>
        : <p className="mu sm2 c chf">{trs("المحادثة مقفولة لأن الروشتة خلصت.")}</p>}
    </div>
  );
}
