import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useAuth } from '../auth.jsx';
import { go } from '../router.js';
import { Icon } from '../icons.jsx';
import { getPos } from '../lib/geo.js';
import { toast, Field } from '../ui.jsx';
import { useCart, setQty, clearCart, cartTotal } from '../lib/cart.js';
import { trs, tdata } from '../lib/i18n.js';

export default function Cart() {
  const { user, profile } = useAuth();
  const cart = useCart();
  const list = Object.values(cart.items), total = cartTotal(cart);
  const [co, setCo] = useState({ phone: '', address: '', note: '', dest: null }), [busy, setBusy] = useState(false);
  if (!list.length) return <div className="card center"><Icon n="cart" s={44} /><h2>{trs("السلة فاضية")}</h2><p className="mu">{trs("ضيف منتجات من المتجر وهتظهر هنا.")}</p><a className="btn" href="#/shop">{trs("تصفّح المتجر")}</a></div>;
  const send = async (e) => {
    e.preventDefault();
    if (!user) { toast(trs("سجّل دخولك الأول عشان تكمل الطلب")); return go('/login'); }
    if (profile?.role !== 'patient') return toast(trs("الطلب متاح لحسابات المرضى فقط"));
    if (co.phone.trim().length < 8 || co.address.trim().length < 5) return toast(trs("اكتب رقم الموبايل والعنوان بالتفصيل"));
    setBusy(true);
    try {
      await addDoc(collection(db, 'orders'), {
        patientId: user.uid, patientName: profile.name, phone: co.phone.trim(), address: co.address.trim(), note: co.note.trim(),
        pharmacyId: cart.pid, pharmacyName: cart.pname,
        items: list.map((x) => ({ productId: x.id, name: x.name, dose: x.dose || '', price: x.price, qty: x.qty })),
        ...(co.dest ? { dest: co.dest } : {}),
        total, status: 'new', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      toast(trs("تم إرسال طلبك للصيدلية ✓")); clearCart(); go('/orders');
    } catch (x) { toast(trs("تعذر إرسال الطلب: ") + x.message); }
    setBusy(false);
  };
  return (
    <div className="cartpg">
      <h1>{trs("السلة")}</h1>
      <p className="mu">{trs("من")}{" "}<b>{cart.pname}</b></p>
      <div className="card">{list.map((x) => (
        <div className="prod" key={x.id}>
          {x.imageUrl ? <img src={x.imageUrl} alt={x.name} /> : <div className="noimg"><Icon n="pill" s={30} /></div>}
          <div className="pi"><b>{x.name}</b><div className="mu sm2">{tdata(x.dose)}</div></div>
          <div className="pr"><b>{x.price * x.qty} {trs("ج.م")}</b>
            <div className="qty"><button onClick={() => setQty(x.id, x.qty - 1)}>−</button><span>{x.qty}</span><button onClick={() => setQty(x.id, x.qty + 1)}>＋</button></div></div>
        </div>))}
        <div className="row between" style={{ padding: '12px 4px 0' }}><b>{trs("الإجمالي")}</b><b className="price">{total} {trs("ج.م")}</b></div>
        <p className="mu sm2">{trs("(الدفع عند الاستلام)")}</p>
        <button className="btn o sm" onClick={() => confirm(trs("تفريغ السلة؟")) && clearCart()}>{trs("تفريغ السلة")}</button>
      </div>
      <form className="card" onSubmit={send}>
        <h2>{trs("إتمام الطلب")}</h2>
        <Field label={trs("رقم الموبايل")} name="phone" type="tel" v={co.phone} on={(v) => setCo({ ...co, phone: v })} dir="ltr" />
        <Field label={trs("عنوان التوصيل")} name="address" v={co.address} on={(v) => setCo({ ...co, address: v })} />
        <button type="button" className="btn o sm" onClick={async () => { try { const p = await getPos(); setCo((c) => ({ ...c, dest: { lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6) } })); toast(trs("تم تحديد موقع التوصيل ✓")); } catch { toast(trs("اسمح بالوصول للموقع")); } }}><Icon n="pin" s={16} /> {co.dest ? trs("تم تحديد موقع التوصيل ✓") : trs("حدد موقع التوصيل (عشان تتابع المندوب)")}</button>
        <Field label={trs("ملاحظات (اختياري)")} name="note" type="textarea" v={co.note} on={(v) => setCo({ ...co, note: v })} />
        <button className="btn g" disabled={busy}>{busy ? '…' : user ? trs("تأكيد الطلب") : trs("سجّل دخولك لإتمام الطلب")}</button>
      </form>
    </div>
  );
}
