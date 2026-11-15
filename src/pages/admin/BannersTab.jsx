import { useCallback, useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, getDocs, limit, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { Badge, toast } from '../../ui.jsx';
import { Icon } from '../../icons.jsx';
import { bannerImage } from '../../lib/img.js';
import { Empty } from './common.jsx';

export default function BannersAdmin() {
  const E = { title: '', sub: '', link: '', imageUrl: '', active: true };
  const [rows, setRows] = useState(null), [f, setF] = useState(E), [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const s = await getDocs(query(collection(db, 'banners'), limit(50)));
    setRows(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order || 0) - (b.order || 0)));
  }, []);
  useEffect(() => { load().catch((e) => toast('تعذر تحميل الإعلانات: ' + (e.code || e.message))); }, [load]);
  const pick = async (e) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    try { setF((x) => ({ ...x, imageUrl: '' })); const d = await bannerImage(file); setF((x) => ({ ...x, imageUrl: d })); }
    catch (x) { toast(x.message); }
  };
  const add = async (e) => {
    e.preventDefault();
    const title = f.title.trim(), sub = f.sub.trim(), link = f.link.trim();
    if (!f.imageUrl && !title) return toast('اكتب عنوان أو ارفع صورة');
    if (link && !/^(#\/|https:\/\/)/.test(link)) return toast('الرابط لازم يبدأ بـ https:// أو #/ (صفحة داخل الموقع)');
    setBusy(true);
    try {
      const order = Math.max(0, ...(rows || []).map((r) => r.order || 0)) + 1;
      await addDoc(collection(db, 'banners'), { title, sub, link, imageUrl: f.imageUrl, order, active: f.active, createdAt: serverTimestamp() });
      setF(E); toast('تمت إضافة الإعلان ✓'); await load();
    } catch (x) { toast('تعذر الحفظ: ' + (x.code || x.message)); } finally { setBusy(false); }
  };
  const upd = async (b, patch) => {
    try { await updateDoc(doc(db, 'banners', b.id), patch); setRows((l) => l.map((x) => (x.id === b.id ? { ...x, ...patch } : x))); }
    catch (x) { toast('تعذر التعديل: ' + (x.code || x.message)); }
  };
  const move = async (k, d) => {
    const a = rows[k], b = rows[k + d]; if (!a || !b) return;
    const oa = a.order || 0, ob = b.order || 0, same = oa === ob;
    await upd(a, { order: same ? ob + d : ob }); await upd(b, { order: oa }); await load();
  };
  const del = async (b) => {
    if (!confirm('حذف الإعلان ده؟')) return;
    try { await deleteDoc(doc(db, 'banners', b.id)); setRows((l) => l.filter((x) => x.id !== b.id)); toast('تم الحذف ✓'); }
    catch (x) { toast('تعذر الحذف: ' + (x.code || x.message)); }
  };
  return (
    <>
      <form className="card" onSubmit={add} style={{ padding: 18, marginBottom: 14 }}>
        <h3>إضافة إعلان للرئيسية</h3>
        <div className="row g wrap" style={{ marginTop: 8 }}>
          <input className="fi" style={{ flex: '1 1 220px' }} maxLength={80} placeholder="العنوان (اختياري لو في صورة)" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <input className="fi" style={{ flex: '2 1 260px' }} maxLength={160} placeholder="سطر توضيحي (اختياري)" value={f.sub} onChange={(e) => setF({ ...f, sub: e.target.value })} />
        </div>
        <div className="row g wrap" style={{ marginTop: 8 }}>
          <input className="fi" dir="ltr" style={{ flex: '1 1 260px' }} placeholder="الرابط عند الضغط: #/search?cat=… أو https://…" value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} />
          <label className="btn o sm" style={{ cursor: 'pointer' }}>{f.imageUrl ? 'تغيير الصورة' : 'رفع صورة'}<input type="file" accept="image/*" hidden onChange={pick} /></label>
          <label className="row g" style={{ gap: 6 }}><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> ظاهر</label>
        </div>
        {f.imageUrl && <img src={f.imageUrl} alt="" style={{ marginTop: 10, width: '100%', maxWidth: 420, borderRadius: 14, aspectRatio: '1000/375', objectFit: 'cover' }} />}
        <p className="mu sm2" style={{ marginTop: 8 }}>الصورة بتتقصّ تلقائي بنسبة 1000×375 وتتضغط. لو مفيش إعلانات خالص، الرئيسية بتعرض 3 إعلانات جاهزة عن مزايا الموقع (الروشتة، التتبّع، تسجيل الصيدليات).</p>
        <button className="btn" disabled={busy} style={{ marginTop: 8 }}>{busy ? '…' : 'إضافة الإعلان'}</button>
      </form>
      <div className="card adm-tw">{!rows ? <Empty>جاري التحميل…</Empty> : !rows.length ? <Empty>مفيش إعلانات. الرئيسية بتعرض الإعلانات الجاهزة.</Empty> :
        <table className="adm-t"><thead><tr><th></th><th>الإعلان</th><th>الرابط</th><th>الحالة</th><th>إجراءات</th></tr></thead>
          <tbody>{rows.map((b, k) => (
            <tr key={b.id} className={b.active === false ? 'adm-blk' : ''}>
              <td><div className="adm-th" style={{ width: 96 }}>{b.imageUrl ? <img src={b.imageUrl} alt="" /> : <Icon n="star" s={18} />}</div></td>
              <td><b>{b.title || '(صورة فقط)'}</b><div className="mu sm2">{b.sub}</div></td><td dir="ltr" className="mu">{b.link || '—'}</td>
              <td>{b.active === false ? <Badge c="am">مخفي</Badge> : <Badge c="ok">ظاهر</Badge>}</td>
              <td><div className="row g"><button className="btn o sm" disabled={k === 0} onClick={() => move(k, -1)}>▲</button><button className="btn o sm" disabled={k === rows.length - 1} onClick={() => move(k, 1)}>▼</button>
                <button className="btn o sm" onClick={() => upd(b, { active: b.active === false })}>{b.active === false ? 'إظهار' : 'إخفاء'}</button><button className="btn o sm" onClick={() => del(b)}>حذف</button></div></td></tr>))}</tbody></table>}</div>
    </>
  );
}
