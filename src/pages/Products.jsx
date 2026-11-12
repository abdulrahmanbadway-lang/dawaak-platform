import { useEffect, useMemo, useState } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';
import { uploadImage } from '../lib/img.js';
import { norm } from '../lib/text.js';
import { FORMS } from '../lib/gov.js';
import { CATS, subsOf, resolveCat } from '../lib/cats.js';
import { Field, Badge, toast } from '../ui.jsx';
import { Icon } from '../icons.jsx';
import '../shop.css';
import { trs, tdata } from '../lib/i18n.js';

const EMPTY = { name: '', ingredient: '', dose: '', form: '', category: '', sub: '', brand: '', oldPrice: '', price: '', stock: '', rx: false, description: '', warnings: '' };

export default function Products({ uid }) {
  const [rows, setRows] = useState(null), [f, setF] = useState(null), [file, setFile] = useState(null), [busy, setBusy] = useState(false), [flt, setFlt] = useState('');
  const load = async () => {
    const s = await getDocs(query(collection(db, 'products'), where('pharmacyId', '==', uid)));
    setRows(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name, 'ar')));
  };
  useEffect(() => { load().catch((e) => toast(trs("تعذر التحميل: ") + e.message)); }, [uid]);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
  const prev = useMemo(() => (file ? URL.createObjectURL(file) : f?.imageUrl || ''), [file, f?.imageUrl]);

  const save = async (e) => {
    e.preventDefault();
    const price = +f.price, stock = parseInt(f.stock, 10);
    const oldPrice = f.oldPrice === '' ? 0 : +f.oldPrice;
    if (oldPrice && !(oldPrice > price)) return toast(trs("السعر قبل الخصم لازم يكون أكبر من السعر الحالي"));
    if (f.name.trim().length < 2) return toast(trs("اكتب اسم الدوا"));
    if (!(price > 0)) return toast(trs("اكتب السعر"));
    if (!(stock >= 0)) return toast(trs("اكتب الكمية المتاحة (0 أو أكتر)"));
    setBusy(true);
    try {
      const imageUrl = file ? await uploadImage(file, uid) : f.imageUrl || '';
      const data = { pharmacyId: uid, name: f.name.trim(), nameLower: norm(f.name), ingredient: f.ingredient.trim(), ingredientLower: norm(f.ingredient),
        dose: f.dose.trim(), form: f.form, category: f.category || '', sub: f.category && subsOf(f.category).includes(f.sub) ? f.sub : '', brand: f.brand.trim().slice(0, 60), oldPrice, price, stock, rx: !!f.rx, description: f.description.trim(), warnings: f.warnings.trim(), imageUrl, updatedAt: serverTimestamp() };
      if (f.id) await updateDoc(doc(db, 'products', f.id), data);
      else await addDoc(collection(db, 'products'), { ...data, createdAt: serverTimestamp() });
      toast(trs("تم حفظ المنتج ✓")); setF(null); setFile(null); await load();
    } catch (x) { toast(trs("تعذر الحفظ: ") + x.message); }
    setBusy(false);
  };
  const del = async (p) => { if (!confirm(trs("حذف ") + p.name + trs("؟"))) return; await deleteDoc(doc(db, 'products', p.id)); await load(); };
  const bump = async (p, n) => { const stock = Math.max(0, p.stock + n); await updateDoc(doc(db, 'products', p.id), { stock, updatedAt: serverTimestamp() }); await load(); };

  if (f) return (
    <form className="card narrow" onSubmit={save}>
      <h2>{f.id ? trs("تعديل منتج") : trs("إضافة منتج")}</h2>
      <Field label={trs("اسم الدوا / المنتج")} name="name" v={f.name} on={set('name')} />
      <Field label={trs("المادة الفعالة")} name="ingredient" v={f.ingredient} on={set('ingredient')} placeholder={trs("مثلاً Paracetamol")} />
      <div className="row g"><div style={{ flex: 1 }}><Field label={trs("الجرعة / التركيز")} name="dose" v={f.dose} on={set('dose')} placeholder={trs("500 ملجم")} /></div><div style={{ flex: 1 }}><Field label={trs("الشكل")} name="form" type="select" options={FORMS} v={f.form} on={set('form')} /></div></div>
      <div className="row g wrap"><div style={{ flex: 1, minWidth: 180 }}><Field label={trs("القسم")} name="category" type="select" options={CATS} v={f.category || ''} on={(v) => setF({ ...f, category: v, sub: '' })} /></div>
        <div style={{ flex: 1, minWidth: 180 }}><Field label={trs("القسم الفرعي")} name="sub" type="select" options={subsOf(f.category)} v={f.sub || ''} on={set('sub')} disabled={!f.category} /></div></div>
      <div className="row g wrap"><div style={{ flex: 1, minWidth: 180 }}><Field label={trs("الماركة (اختياري)")} name="brand" v={f.brand || ''} on={set('brand')} maxLength={60} placeholder={trs("مثال: Pfizer")} /></div>
        <div style={{ flex: 1, minWidth: 180 }}><Field label={trs("السعر قبل الخصم (اختياري)")} name="oldPrice" type="number" v={f.oldPrice || ''} on={set('oldPrice')} min="0" step="0.5" hint={trs("لو كتبته المنتج بيظهر في صفحة العروض بنسبة الخصم")} /></div></div>
      <div className="row g"><div style={{ flex: 1 }}><Field label={trs("السعر (ج.م)")} name="price" type="number" step="0.5" min="0" v={f.price} on={set('price')} /></div><div style={{ flex: 1 }}><Field label={trs("الكمية المتاحة")} name="stock" type="number" min="0" v={f.stock} on={set('stock')} /></div></div>
      <Field label={trs("يحتاج روشتة طبية")} name="rx" type="checkbox" v={f.rx} on={set('rx')} />
      <Field label={trs("طريقة الاستخدام والتفاصيل")} name="description" type="textarea" v={f.description} on={set('description')} />
      <Field label={trs("تحذيرات وتداخلات")} name="warnings" type="textarea" v={f.warnings} on={set('warnings')} />
      <div className="fd"><label>{trs("صورة المنتج")}</label>
        <div className="imgp">
          <div className="imgpv">{prev ? <img src={prev} alt="" /> : <Icon n="pill" s={34} />}</div>
          <div className="row g wrap">
            <label className="btn o sm"><Icon n="camera" s={16} />{trs("صوّر العبوة")}<input hidden type="file" accept="image/*" capture="environment" onChange={(e) => setFile(e.target.files[0] || null)} /></label>
            <label className="btn o sm">{trs("من الجهاز")}<input hidden id="img" type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0] || null)} /></label>
            {prev && <button type="button" className="btn o sm" onClick={() => { setFile(null); setF((s) => ({ ...s, imageUrl: '' })); }}>{trs("حذف الصورة")}</button>}
          </div>
        </div>
        <small>{trs("صورة حقيقية وواضحة للعبوة من قدّام. بتتضغط تلقائياً.")}</small></div>
      <div className="row g"><button className="btn g" style={{ flex: 1 }} disabled={busy}>{busy ? '…' : trs("حفظ")}</button><button type="button" className="btn o" onClick={() => { setF(null); setFile(null); }}>{trs("إلغاء")}</button></div>
    </form>
  );
  const shown = (rows || []).filter((p) => !flt || norm(p.name).includes(norm(flt)));
  return (
    <div>
      <div className="row between wrap g bar2"><input className="fi sel" placeholder={trs("ابحث في منتجاتك…")} value={flt} onChange={(e) => setFlt(e.target.value)} /><button className="btn" id="addp" onClick={() => setF({ ...EMPTY })}>{trs("＋ إضافة منتج")}</button></div>
      {rows && !rows.length && <div className="card center"><p className="mu">{trs("لسه مضفتش منتجات. ابدأ بإضافة أول دوا.")}</p></div>}
      {shown.map((p) => (
        <div className="card prod" key={p.id}>
          {p.imageUrl ? <img src={p.imageUrl} alt="" /> : <div className="noimg"><Icon n="pill" s={30} /></div>}
          <div className="pi"><b>{p.name}</b> {p.rx && <Badge c="am">{trs("روشتة")}</Badge>}<div className="mu sm2">{[tdata(p.dose), tdata(p.form), p.ingredient].filter(Boolean).join(' · ')}</div>
            <div><b className="dist">{p.price} {trs("ج.م")}</b> · <Badge c={p.stock > 0 ? (p.stock < 5 ? 'am' : 'ok') : 'rd'}>{p.stock > 0 ? trs("المتاح: ") + p.stock : trs("نفد")}</Badge></div></div>
          <div className="pr"><div className="qty"><button onClick={() => bump(p, -1)}>−</button><span>{p.stock}</span><button onClick={() => bump(p, 1)}>＋</button></div>
            <div className="row g"><button className="btn o sm" onClick={() => setF({ ...EMPTY, ...p, category: resolveCat(p)[0], sub: resolveCat(p)[1], brand: p.brand || '', oldPrice: p.oldPrice ? String(p.oldPrice) : '', price: String(p.price), stock: String(p.stock) })}>{trs("تعديل")}</button><button className="btn o sm" onClick={() => del(p)}>{trs("حذف")}</button></div></div>
        </div>
      ))}
    </div>
  );
}
