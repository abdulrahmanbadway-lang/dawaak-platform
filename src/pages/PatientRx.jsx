import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, addDoc, updateDoc, doc, writeBatch, limit, query, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useAuth } from '../auth.jsx';
import { go } from '../router.js';
import { Icon } from '../icons.jsx';
import { GOV } from '../lib/gov.js';
import { km, fmtKm, getPos } from '../lib/geo.js';
import { rxImage } from '../lib/img.js';
import { useRx } from '../lib/rx.js';
import { RX_LABEL, RX_TONE, RX_OPEN } from '../lib/status.js';
import { Badge, Field, toast } from '../ui.jsx';
import { Thumbs, QuoteView, Chat, fmtTime } from '../rxparts.jsx';
import { trs, tdata } from '../lib/i18n.js';

function NewRx({ q }) {
  const { user, profile } = useAuth();
  const [phs, setPhs] = useState(null), [pid, setPid] = useState(q.get('ph') || '');
  const [gov, setGov] = useState(''), [loc, setLoc] = useState(null), [dest, setDest] = useState(null);
  const [imgs, setImgs] = useState([]), [prep, setPrep] = useState(false), [busy, setBusy] = useState(false);
  const [f, setF] = useState({ phone: '', address: '', note: '' });
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    getDocs(query(collection(db, 'pharmacies'), limit(200)))
      .then((s) => setPhs(s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => p.status === 'active')))
      .catch((e) => { toast(trs("تعذر تحميل الصيدليات: ") + e.message); setPhs([]); });
  }, []);
  const list = useMemo(() => (phs || []).filter((p) => !gov || p.governorate === gov)
    .map((p) => ({ ...p, d: loc && p.lat != null ? km(loc, p) : null }))
    .sort((a, b) => (+!!b.open - +!!a.open) || ((a.d ?? 1e9) - (b.d ?? 1e9)) || (+!!b.verified - +!!a.verified)), [phs, gov, loc]);

  const myLoc = async () => { try { setLoc(await getPos()); toast(trs("تم تحديد موقعك ✓")); } catch { toast(trs("اسمح بالوصول للموقع أو اختار المحافظة")); } };
  const pick = async (e) => {
    const files = [...e.target.files]; e.target.value = '';
    if (!files.length) return;
    if (imgs.length + files.length > 3) return toast(trs("أقصى حد 3 صور للروشتة"));
    setPrep(true);
    try { const out = []; for (const x of files) out.push(await rxImage(x)); setImgs((s) => [...s, ...out]); } catch (x) { toast(x.message); }
    setPrep(false);
  };
  const submit = async (e) => {
    e.preventDefault();
    const ph = (phs || []).find((p) => p.id === pid);
    if (!ph) return toast(trs("اختار الصيدلية اللي هتبعتلها الروشتة"));
    if (!imgs.length) return toast(trs("ارفع صورة الروشتة"));
    if (f.phone.trim().length < 8 || f.address.trim().length < 5) return toast(trs("اكتب رقم الموبايل والعنوان بالتفصيل"));
    setBusy(true);
    try {
      await addDoc(collection(db, 'prescriptions'), {
        patientId: user.uid, patientName: profile.name, pharmacyId: ph.id, pharmacyName: ph.name,
        phone: f.phone.trim(), address: f.address.trim(), note: f.note.trim(), images: imgs, ...(dest ? { dest } : {}),
        status: 'pending', createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      toast(trs("تم إرسال الروشتة للصيدلي ✓")); go('/rx');
    } catch (x) { toast(trs("تعذر الإرسال: ") + x.message); }
    setBusy(false);
  };

  return (
    <form onSubmit={submit}>
      <h1>{trs("ارفع روشتة")}</h1>
      <p className="mu">{trs("اختار الصيدلية وارفع صورة الروشتة. الصيدلي هيراجعها ويرد عليك بالأصناف والأسعار، ومفيش أي طلب بيتنفذ غير بعد ما إنت تأكد.")}</p>
      <div className="card">
        <h3>{trs("1) اختار الصيدلية")}</h3>
        <div className="row g wrap bar2">
          <button type="button" className="btn o sm" onClick={myLoc}><Icon n="pin" s={16} /> {loc ? trs("تم تحديد موقعك") : trs("استخدم موقعي")}</button>
          <select className="fi sel" value={gov} onChange={(e) => setGov(e.target.value)}><option value="">{trs("كل المحافظات")}</option>{GOV.map((g) => <option key={g} value={g}>{trs(g)}</option>)}</select>
        </div>
        {!phs && <p className="mu">{trs("جاري التحميل…")}</p>}
        {phs && !list.length && <p className="mu">{trs("مفيش صيدليات متاحة في الاختيار ده.")}</p>}
        <div className="plist">{list.map((p) => (
          <label key={p.id} className={'pick' + (pid === p.id ? ' on' : '')}>
            <input type="radio" name="ph" checked={pid === p.id} onChange={() => setPid(p.id)} />
            <div><b>{p.name}</b> {p.verified ? <Badge c="ok">{trs("موثّقة")}</Badge> : <Badge c="am">{trs("قيد التوثيق")}</Badge>}
              <div className="mu sm2">{trs(p.governorate)} · <bdi>{p.address}</bdi>{p.hours ? ' · ' + tdata(p.hours) : ''}</div></div>
            <div className="tr">{p.d != null && <b className="dist">{fmtKm(p.d)}</b>}<div><Badge c={p.open ? 'ok' : 'rd'}>{p.open ? trs("مفتوحة") : trs("مغلقة")}</Badge></div></div>
          </label>
        ))}</div>
      </div>
      <div className="card">
        <h3>{trs("2) صورة الروشتة")}</h3>
        <p className="mu sm2">{trs("لحد 3 صور. اتأكد إن الكتابة واضحة والإضاءة كويسة.")}</p>
        <div className="thumbs">
          {imgs.map((s, i) => <div key={i} className="thumb"><img src={s} alt="" /><button type="button" className="x" aria-label={trs("حذف الصورة")} onClick={() => setImgs((a) => a.filter((_, k) => k !== i))}>✕</button></div>)}
          {imgs.length < 3 && <label className="thumb add">{prep ? '…' : '＋'}<input type="file" accept="image/*" multiple hidden onChange={pick} disabled={prep} /></label>}
        </div>
      </div>
      <div className="card">
        <h3>{trs("3) بيانات التوصيل")}</h3>
        <Field label={trs("رقم الموبايل")} name="phone" type="tel" v={f.phone} on={set('phone')} dir="ltr" maxLength={20} />
        <Field label={trs("عنوان التوصيل")} name="address" v={f.address} on={set('address')} maxLength={300} />
        <button type="button" className="btn o sm" onClick={async () => { try { const x = await getPos(); setDest({ lat: +x.lat.toFixed(6), lng: +x.lng.toFixed(6) }); toast(trs("تم تحديد موقع التوصيل ✓")); } catch { toast(trs("اسمح بالوصول للموقع")); } }}><Icon n="pin" s={16} /> {dest ? trs("تم تحديد موقع التوصيل ✓") : trs("حدد موقع التوصيل (عشان تتابع المندوب)")}</button>
        <Field label={trs("ملاحظات للصيدلي (اختياري)")} name="note" type="textarea" v={f.note} on={set('note')} maxLength={500} placeholder={trs("مثلاً: عندي حساسية من البنسلين")} />
        <button className="btn g full" disabled={busy || prep}>{busy ? '…' : trs("إرسال الروشتة للصيدلي")}</button>
      </div>
    </form>
  );
}

function List() {
  const { user } = useAuth();
  const { rows, err } = useRx('patientId', user.uid);
  const [chat, setChat] = useState(null), [busy, setBusy] = useState(null);
  useEffect(() => { if (err) toast(trs("تعذر تحميل الروشتات: ") + err); }, [err]);

  const cancel = async (r) => {
    if (!confirm(trs("إلغاء الروشتة؟"))) return;
    try { await updateDoc(doc(db, 'prescriptions', r.id), { status: 'cancelled', updatedAt: serverTimestamp() }); } catch (e) { toast(trs("تعذر الإلغاء: ") + e.message); }
  };
  // تأكيد عرض الصيدلي: الطلب والروشتة بيتكتبوا في عملية واحدة (batch)، والـ Rules بتتأكد إن الطلب مطابق للعرض بالظبط
  const accept = async (r) => {
    if (!confirm(trs("تأكيد الطلب بإجمالي ") + r.quote.total + trs(" ج.م (الدفع عند الاستلام)؟"))) return;
    setBusy(r.id);
    try {
      const oref = doc(collection(db, 'orders')), b = writeBatch(db);
      b.set(oref, {
        patientId: user.uid, patientName: r.patientName, phone: r.phone, address: r.address, note: r.note || '',
        pharmacyId: r.pharmacyId, pharmacyName: r.pharmacyName, items: r.quote.items, total: r.quote.total,
        ...(r.dest ? { dest: r.dest } : {}), status: 'new', source: 'rx', prescriptionId: r.id, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      });
      b.update(doc(db, 'prescriptions', r.id), { status: 'ordered', orderId: oref.id, updatedAt: serverTimestamp() });
      await b.commit(); toast(trs("تم تأكيد الطلب ✓")); go('/orders');
    } catch (x) { toast(trs("تعذر تأكيد الطلب (ممكن الصيدلي عدّل العرض، حدّث الصفحة وراجعه): ") + x.message); }
    setBusy(null);
  };

  return (
    <div>
      <div className="row between wrap"><h1>{trs("روشتاتي")}</h1><a className="btn" href="#/rx/new">{trs("＋ روشتة جديدة")}</a></div>
      {rows && !rows.length && <div className="card center"><p className="mu">{trs("لسه مرفعتش أي روشتة.")}</p><a className="btn" href="#/rx/new">{trs("ارفع روشتة")}</a></div>}
      {rows?.map((r) => (
        <div className="card" key={r.id}>
          <div className="row between wrap"><div><h3>{r.pharmacyName} <Badge c={RX_TONE[r.status]}>{trs(RX_LABEL[r.status])}</Badge></h3><p className="mu sm2">{fmtTime(r.createdAt)}</p></div></div>
          <Thumbs images={r.images} />
          {r.note && <p className="sm2">{trs("ملاحظتك:")}{" "}{r.note}</p>}
          {r.status === 'quoted' && <><h3>{trs("عرض الصيدلي")}</h3><QuoteView quote={r.quote} /></>}
          {r.status === 'unavailable' && <p className="err">{trs("الصيدلي رد بإن الروشتة غير متاحة. شوف الرسائل أو ارفعها لصيدلية تانية.")}</p>}
          {r.status === 'ordered' && <p className="ok">{trs("تم تحويل الروشتة لطلب.")}{" "}<a className="go" href="#/orders">{trs("تابع طلبك ◂")}</a></p>}
          <div className="row g wrap">
            {r.status === 'quoted' && <button className="btn g sm" disabled={busy === r.id} onClick={() => accept(r)}>{busy === r.id ? '…' : trs("تأكيد وإرسال كطلب")}</button>}
            <button className="btn o sm" onClick={() => setChat(chat === r.id ? null : r.id)}><Icon n="chat" s={16} /> {chat === r.id ? trs("إخفاء الرسائل") : trs("الرسائل")}</button>
            {RX_OPEN.includes(r.status) && <button className="btn o sm" onClick={() => cancel(r)}>{r.status === 'quoted' ? trs("رفض العرض وإلغاء") : trs("إلغاء الروشتة")}</button>}
          </div>
          {chat === r.id && <Chat rx={r} role="patient" uid={user.uid} />}
        </div>
      ))}
    </div>
  );
}

export default function PatientRx({ path, q }) { return path === '/rx/new' ? <NewRx q={q} /> : <List />; }
