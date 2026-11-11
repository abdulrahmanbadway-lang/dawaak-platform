import { useEffect, useState } from 'react';
import { collection, getDocs, query, where, doc, updateDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';
import { RX_LABEL, RX_TONE } from '../lib/status.js';
import { Icon } from '../icons.jsx';
import { Badge, Field, toast } from '../ui.jsx';
import { Thumbs, QuoteView, Chat, fmtTime } from '../rxparts.jsx';
import { trs } from '../lib/i18n.js';

const BLANK = { name: '', dose: '', price: '', qty: '1' };

// بناء عرض السعر: أصناف من منتجات الصيدلية أو بنود يدوية
function QuoteModal({ rx, uid, onClose }) {
  const [prods, setProds] = useState([]), [busy, setBusy] = useState(false);
  const [lines, setLines] = useState(() => rx.quote ? rx.quote.items.map((i) => ({ ...i, price: String(i.price), qty: String(i.qty) })) : [{ ...BLANK }]);
  const [note, setNote] = useState(rx.quote?.note || '');
  useEffect(() => {
    getDocs(query(collection(db, 'products'), where('pharmacyId', '==', uid)))
      .then((s) => setProds(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name, 'ar')))).catch(() => {});
  }, [uid]);
  const upd = (k, key, v) => setLines((L) => L.map((l, i) => (i === k ? { ...l, [key]: v } : l)));
  const addProd = (id) => {
    const p = prods.find((x) => x.id === id);
    if (p) setLines((L) => [...L.filter((l) => l.name || l.price), { productId: p.id, name: p.name, dose: p.dose || '', price: String(p.price), qty: '1' }]);
  };
  const total = Math.round(lines.reduce((s, l) => s + (+l.price || 0) * (+l.qty || 0), 0) * 100) / 100;

  const submit = async (e) => {
    e.preventDefault();
    const items = [];
    for (const l of lines) {
      const price = +l.price, qty = +l.qty;
      if (l.name.trim().length < 2) return toast(trs("اكتب اسم كل صنف"));
      if (!(price > 0)) return toast(trs("اكتب سعر ") + l.name);
      if (!Number.isInteger(qty) || qty < 1 || qty > 99) return toast(trs("الكمية لازم تكون من 1 لـ 99"));
      const it = { name: l.name.trim(), dose: (l.dose || '').trim(), price, qty };
      if (l.productId) it.productId = l.productId;
      items.push(it);
    }
    if (!items.length) return toast(trs("ضيف صنف واحد على الأقل"));
    setBusy(true);
    try {
      await updateDoc(doc(db, 'prescriptions', rx.id), { status: 'quoted', quote: { items, total: Math.round(items.reduce((s, i) => s + i.price * i.qty, 0) * 100) / 100, note: note.trim() }, updatedAt: serverTimestamp() });
      toast(trs("تم إرسال العرض للمريض ✓")); onClose();
    } catch (x) { toast(trs("تعذر الإرسال: ") + x.message); }
    setBusy(false);
  };
  const stockOf = (l) => (l.productId ? prods.find((p) => p.id === l.productId)?.stock : null);
  return (
    <div className="mo" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="card wide" onSubmit={submit}>
        <h2>{rx.quote ? trs("تعديل العرض") : trs("تجهيز عرض سعر")}</h2>
        {prods.length > 0 && <div className="fd"><label>{trs("أضف من منتجاتك")}</label>
          <select className="fi" value="" onChange={(e) => addProd(e.target.value)}><option value="">{trs("اختر منتج…")}</option>{prods.map((p) => <option key={p.id} value={p.id}>{p.name} {p.dose} — {p.price} {trs("ج.م (المتاح")}{" "}{p.stock})</option>)}</select></div>}
        {lines.map((l, k) => (
          <div className="qln" key={k}>
            <input className="fi" placeholder={trs("اسم الدوا")} value={l.name} onChange={(e) => upd(k, 'name', e.target.value)} />
            <input className="fi" placeholder={trs("الجرعة")} value={l.dose || ''} onChange={(e) => upd(k, 'dose', e.target.value)} />
            <input className="fi" placeholder={trs("السعر")} type="number" min="0" step="0.5" dir="ltr" value={l.price} onChange={(e) => upd(k, 'price', e.target.value)} />
            <input className="fi" placeholder={trs("الكمية")} type="number" min="1" max="99" dir="ltr" value={l.qty} onChange={(e) => upd(k, 'qty', e.target.value)} />
            <button type="button" className="btn o sm" aria-label={trs("حذف البند")} onClick={() => setLines((L) => L.filter((_, i) => i !== k))}>✕</button>
            {stockOf(l) != null && stockOf(l) < +l.qty && <small className="err" style={{ gridColumn: '1/-1' }}>{trs("المتاح في مخزونك")}{" "}{stockOf(l)} {trs("فقط")}</small>}
          </div>
        ))}
        <button type="button" className="btn o sm" onClick={() => setLines((L) => [...L, { ...BLANK }])}>{trs("＋ بند يدوي")}</button>
        <Field label={trs("ملاحظة للمريض (اختياري)")} name="qnote" type="textarea" v={note} on={setNote} maxLength={500} placeholder={trs("مثلاً: التوصيل خلال ساعة")} />
        <div className="row between wrap"><b className="dist">{trs("الإجمالي")}{" "}{total} {trs("ج.م")}</b>
          <div className="row g"><button type="button" className="btn o" onClick={onClose}>{trs("إلغاء")}</button><button className="btn g" disabled={busy}>{busy ? '…' : trs("إرسال العرض")}</button></div></div>
      </form>
    </div>
  );
}

// رد نصي بتغيير حالة: need_info (طلب توضيح) أو unavailable (غير متاحة)
function ReplyModal({ rx, uid, mode, onClose }) {
  const [text, setText] = useState(''), [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (text.trim().length < 3) return toast(trs("اكتب الرسالة للمريض"));
    setBusy(true);
    try {
      const b = writeBatch(db);
      b.set(doc(collection(db, 'prescriptions', rx.id, 'messages')), { senderId: uid, role: 'pharmacy', text: text.trim(), createdAt: serverTimestamp() });
      b.update(doc(db, 'prescriptions', rx.id), { status: mode, updatedAt: serverTimestamp() });
      await b.commit(); toast(trs("تم الإرسال ✓")); onClose();
    } catch (x) { toast(trs("تعذر الإرسال: ") + x.message); }
    setBusy(false);
  };
  return (
    <div className="mo" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <form className="card narrow" onSubmit={submit}>
        <h2>{mode === 'need_info' ? trs("طلب توضيح من المريض") : trs("الروشتة غير متاحة")}</h2>
        <Field label={mode === 'need_info' ? trs("إيه اللي محتاج توضيحه؟") : trs("سبب عدم التوفر (هيوصل للمريض)")} name="rtext" type="textarea" v={text} on={setText} maxLength={1000} />
        <div className="row g"><button className="btn full" disabled={busy}>{busy ? '…' : trs("إرسال")}</button><button type="button" className="btn o" onClick={onClose}>{trs("إلغاء")}</button></div>
      </form>
    </div>
  );
}

export default function PharmacyRx({ uid, rows, err }) {
  const [flt, setFlt] = useState('open'), [chat, setChat] = useState(null), [modal, setModal] = useState(null);
  useEffect(() => { if (err) toast(trs("تعذر تحميل الروشتات: ") + err); }, [err]);
  const isOpen = (r) => r.status === 'pending' || r.status === 'need_info';
  const shown = (rows || []).filter((r) => (flt === 'open' ? isOpen(r) : !isOpen(r)));
  return (
    <div>
      <div className="seg"><button className={flt === 'open' ? 'on' : ''} onClick={() => setFlt('open')}>{trs("محتاجة رد (")}{(rows || []).filter(isOpen).length})</button><button className={flt === 'done' ? 'on' : ''} onClick={() => setFlt('done')}>{trs("اتردّ عليها")}</button></div>
      {rows && !shown.length && <div className="card center"><p className="mu">{flt === 'open' ? trs("مفيش روشتات محتاجة رد دلوقتي.") : trs("مفيش روشتات اتردّ عليها لسه.")}</p></div>}
      {shown.map((r) => (
        <div className="card" key={r.id}>
          <div className="row between wrap"><div><h3>{r.patientName} <Badge c={RX_TONE[r.status]}>{trs(RX_LABEL[r.status])}</Badge></h3>
            <p className="mu sm2" dir="ltr" style={{ textAlign: 'right' }}>{r.phone}</p><p className="mu sm2">{r.address} · {fmtTime(r.createdAt)}</p></div></div>
          {r.note && <p className="sm2">{trs("ملاحظة المريض:")}{" "}{r.note}</p>}
          <Thumbs images={r.images} />
          {r.quote && <QuoteView quote={r.quote} />}
          <div className="row g wrap">
            {isOpen(r) && <><button className="btn sm" onClick={() => setModal({ t: 'quote', r })}>{trs("تجهيز عرض سعر")}</button>
              <button className="btn o sm" onClick={() => setModal({ t: 'need_info', r })}>{trs("طلب توضيح")}</button>
              <button className="btn o sm" onClick={() => setModal({ t: 'unavailable', r })}>{trs("غير متاحة")}</button></>}
            {r.status === 'quoted' && <button className="btn o sm" onClick={() => setModal({ t: 'quote', r })}>{trs("تعديل العرض")}</button>}
            <button className="btn o sm" onClick={() => setChat(chat === r.id ? null : r.id)}><Icon n="chat" s={16} /> {chat === r.id ? trs("إخفاء الرسائل") : trs("الرسائل")}</button>
          </div>
          {chat === r.id && <Chat rx={r} role="pharmacy" uid={uid} />}
        </div>
      ))}
      {modal?.t === 'quote' && <QuoteModal rx={modal.r} uid={uid} onClose={() => setModal(null)} />}
      {(modal?.t === 'need_info' || modal?.t === 'unavailable') && <ReplyModal rx={modal.r} uid={uid} mode={modal.t} onClose={() => setModal(null)} />}
    </div>
  );
}
