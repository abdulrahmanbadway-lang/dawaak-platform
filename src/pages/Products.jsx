import { useEffect, useState } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';
import { uploadImage } from '../lib/img.js';
import { norm } from '../lib/text.js';
import { FORMS } from '../lib/gov.js';
import { Field, Badge, toast } from '../ui.jsx';

const EMPTY = { name: '', ingredient: '', dose: '', form: '', price: '', stock: '', rx: false, description: '', warnings: '' };

export default function Products({ uid }) {
  const [rows, setRows] = useState(null), [f, setF] = useState(null), [file, setFile] = useState(null), [busy, setBusy] = useState(false), [flt, setFlt] = useState('');
  const load = async () => {
    const s = await getDocs(query(collection(db, 'products'), where('pharmacyId', '==', uid)));
    setRows(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name, 'ar')));
  };
  useEffect(() => { load().catch((e) => toast('تعذر التحميل: ' + e.message)); }, [uid]);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    const price = +f.price, stock = parseInt(f.stock, 10);
    if (f.name.trim().length < 2) return toast('اكتب اسم الدوا');
    if (!(price > 0)) return toast('اكتب السعر');
    if (!(stock >= 0)) return toast('اكتب الكمية المتاحة (0 أو أكتر)');
    setBusy(true);
    try {
      const imageUrl = file ? await uploadImage(file, uid) : f.imageUrl || '';
      const data = { pharmacyId: uid, name: f.name.trim(), nameLower: norm(f.name), ingredient: f.ingredient.trim(), ingredientLower: norm(f.ingredient),
        dose: f.dose.trim(), form: f.form, price, stock, rx: !!f.rx, description: f.description.trim(), warnings: f.warnings.trim(), imageUrl, updatedAt: serverTimestamp() };
      if (f.id) await updateDoc(doc(db, 'products', f.id), data);
      else await addDoc(collection(db, 'products'), { ...data, createdAt: serverTimestamp() });
      toast('تم حفظ المنتج ✓'); setF(null); setFile(null); await load();
    } catch (x) { toast('تعذر الحفظ: ' + x.message); }
    setBusy(false);
  };
  const del = async (p) => { if (!confirm('حذف ' + p.name + '؟')) return; await deleteDoc(doc(db, 'products', p.id)); await load(); };
  const bump = async (p, n) => { const stock = Math.max(0, p.stock + n); await updateDoc(doc(db, 'products', p.id), { stock, updatedAt: serverTimestamp() }); await load(); };

  if (f) return (
    <form className="card narrow" onSubmit={save}>
      <h2>{f.id ? 'تعديل منتج' : 'إضافة منتج'}</h2>
      <Field label="اسم الدوا / المنتج" name="name" v={f.name} on={set('name')} />
      <Field label="المادة الفعالة" name="ingredient" v={f.ingredient} on={set('ingredient')} placeholder="مثلاً Paracetamol" />
      <div className="row g"><div style={{ flex: 1 }}><Field label="الجرعة / التركيز" name="dose" v={f.dose} on={set('dose')} placeholder="500 ملجم" /></div><div style={{ flex: 1 }}><Field label="الشكل" name="form" type="select" options={FORMS} v={f.form} on={set('form')} /></div></div>
      <div className="row g"><div style={{ flex: 1 }}><Field label="السعر (ج.م)" name="price" type="number" step="0.5" min="0" v={f.price} on={set('price')} /></div><div style={{ flex: 1 }}><Field label="الكمية المتاحة" name="stock" type="number" min="0" v={f.stock} on={set('stock')} /></div></div>
      <Field label="يحتاج روشتة طبية" name="rx" type="checkbox" v={f.rx} on={set('rx')} />
      <Field label="طريقة الاستخدام والتفاصيل" name="description" type="textarea" v={f.description} on={set('description')} />
      <Field label="تحذيرات وتداخلات" name="warnings" type="textarea" v={f.warnings} on={set('warnings')} />
      <div className="fd"><label>صورة المنتج</label><input id="img" type="file" accept="image/*" onChange={(e) => setFile(e.target.files[0] || null)} />
        {(file || f.imageUrl) && <img className="pv" src={file ? URL.createObjectURL(file) : f.imageUrl} alt="" />}</div>
      <div className="row g"><button className="btn g" style={{ flex: 1 }} disabled={busy}>{busy ? '…' : 'حفظ'}</button><button type="button" className="btn o" onClick={() => { setF(null); setFile(null); }}>إلغاء</button></div>
    </form>
  );
  const shown = (rows || []).filter((p) => !flt || norm(p.name).includes(norm(flt)));
  return (
    <div>
      <div className="row between wrap g bar2"><input className="fi sel" placeholder="ابحث في منتجاتك…" value={flt} onChange={(e) => setFlt(e.target.value)} /><button className="btn" id="addp" onClick={() => setF({ ...EMPTY })}>＋ إضافة منتج</button></div>
      {rows && !rows.length && <div className="card center"><p className="mu">لسه مضفتش منتجات. ابدأ بإضافة أول دوا.</p></div>}
      {shown.map((p) => (
        <div className="card prod" key={p.id}>
          {p.imageUrl ? <img src={p.imageUrl} alt="" /> : <div className="noimg">💊</div>}
          <div className="pi"><b>{p.name}</b> {p.rx && <Badge c="am">روشتة</Badge>}<div className="mu sm2">{[p.dose, p.form, p.ingredient].filter(Boolean).join(' · ')}</div>
            <div><b className="dist">{p.price} ج.م</b> · <Badge c={p.stock > 0 ? (p.stock < 5 ? 'am' : 'ok') : 'rd'}>{p.stock > 0 ? 'المتاح: ' + p.stock : 'نفد'}</Badge></div></div>
          <div className="pr"><div className="qty"><button onClick={() => bump(p, -1)}>−</button><span>{p.stock}</span><button onClick={() => bump(p, 1)}>＋</button></div>
            <div className="row g"><button className="btn o sm" onClick={() => setF({ ...p, price: String(p.price), stock: String(p.stock) })}>تعديل</button><button className="btn o sm" onClick={() => del(p)}>حذف</button></div></div>
        </div>
      ))}
    </div>
  );
}
