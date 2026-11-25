import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, deleteDoc, doc, getDocs, limit, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase.js';
import { useAuth } from './auth.jsx';
import { Icon } from './icons.jsx';
import { toast } from './ui.jsx';
import { trs } from './lib/i18n.js';
import { errMsg } from './lib/errors.js';
import './ratebanner.css';

const DESC = { 1: 'سيئة جدًا 😞', 2: 'غير مُرضية 😕', 3: 'مقبولة 😐', 4: 'جيدة 🙂', 5: 'ممتازة 🤩' };
export const REVIEWS_EVENT = 'dw-reviews';

function Stars({ n, on, size = 18 }) {
  const [h, setH] = useState(0);
  return (
    <span className={'rb-stars' + (on ? ' in' : '')} role={on ? 'radiogroup' : undefined} aria-label={on ? trs("اختار تقييمك من 1 إلى 5") : n + '/5'}>
      {[1, 2, 3, 4, 5].map((i) => (on
        ? <button type="button" key={i} role="radio" aria-checked={n === i} aria-label={i + '/5 — ' + trs(DESC[i])} className={i <= (h || n) ? 'on' : ''} onMouseEnter={() => setH(i)} onMouseLeave={() => setH(0)} onClick={() => on(i)}><Icon n="star" s={size} /></button>
        : <i key={i} aria-hidden="true" className={i <= Math.round(n) ? 'on' : ''}><Icon n="star" s={size} /></i>))}
    </span>);
}

// نافذة التقييم: بتكتب في نفس مجموعة reviews (رأي واحد لكل مريض) بنفس قواعد Firestore الحالية
function RateModal({ mine, profile, user, onClose, onDone }) {
  const [f, setF] = useState(mine ? { rating: mine.rating, text: mine.text } : { rating: 0, text: '' }), [busy, setBusy] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', k); ref.current?.querySelector('textarea')?.focus();
    return () => document.removeEventListener('keydown', k);
  }, [onClose, busy]);
  const save = async (e) => {
    e.preventDefault();
    const text = f.text.trim();
    if (!f.rating) return toast(trs("اختار عدد النجوم الأول"));
    if (text.length < 5) return toast(trs("اكتب رأيك في جملة على الأقل"));
    setBusy(true);
    try {
      const name = profile.name.trim().split(/\s+/)[0].slice(0, 40);
      await setDoc(doc(db, 'reviews', user.uid), { name, rating: f.rating, text, createdAt: mine ? mine.createdAt : serverTimestamp(), updatedAt: serverTimestamp() });
      toast(trs("شكراً على رأيك ✓")); onDone(); onClose();
    } catch (x) { toast(trs("تعذر حفظ الرأي: ") + errMsg(x)); setBusy(false); }
  };
  const del = async () => {
    if (!confirm(trs("تحذف رأيك؟"))) return;
    setBusy(true);
    try { await deleteDoc(doc(db, 'reviews', user.uid)); onDone(); onClose(); } catch (x) { toast(errMsg(x)); setBusy(false); }
  };
  return (
    <div className="mo" role="dialog" aria-modal="true" aria-labelledby="rbt" onClick={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <form className="card narrow rb-modal" ref={ref} onSubmit={save} noValidate>
        <button type="button" className="rb-x" onClick={onClose} aria-label={trs("إغلاق")}>×</button>
        <h3 id="rbt">{trs("قيّم تجربتك مع دواك")}</h3>
        <div className="rb-pick"><Stars n={f.rating} on={(i) => setF((x) => ({ ...x, rating: i }))} size={30} /><b className="rb-d" aria-live="polite">{f.rating ? trs(DESC[f.rating]) : trs("اختار تقييمك")}</b></div>
        <textarea className="fi" rows={4} maxLength={300} value={f.text} onChange={(e) => setF((x) => ({ ...x, text: e.target.value }))} placeholder={trs("اكتب تجربتك مع دواك…")} aria-label={trs("رأيك")} />
        <p className="mu sm2">{trs("بيظهر اسمك الأول بس.")} · {f.text.length}/300</p>
        <div className="row g wrap"><button className="btn" disabled={busy}>{busy ? '…' : mine ? trs("حفظ التعديل") : trs("نشر")}</button>
          <button type="button" className="btn o" onClick={onClose} disabled={busy}>{trs("إلغاء")}</button>
          {mine && <button type="button" className="btn o" onClick={del} disabled={busy}>{trs("حذف رأيي")}</button>}</div>
      </form>
    </div>);
}

// بانر التقييم: المتوسط الحقيقي من آراء العملاء + زر يفتح نافذة التقييم
export default function RateBanner() {
  const { user, profile } = useAuth();
  const [rows, setRows] = useState(null), [open, setOpen] = useState(false);
  const load = () => getDocs(query(collection(db, 'reviews'), limit(40))).then((s) => setRows(s.docs.map((d) => ({ id: d.id, ...d.data() })))).catch(() => setRows([]));
  useEffect(() => { load(); }, []);
  const avg = useMemo(() => (rows && rows.length ? rows.reduce((a, r) => a + (Number(r.rating) || 0), 0) / rows.length : 0), [rows]);
  const mine = user && rows ? rows.find((r) => r.id === user.uid) : null;
  const canWrite = user && profile?.role === 'patient';
  const done = () => { load(); window.dispatchEvent(new Event(REVIEWS_EVENT)); };
  if (rows === null) return null;
  return (
    <>
      <section className="rb" aria-labelledby="rbh">
        <div className="rb-copy">
          <span className="rb-kick"><Icon n="star" s={13} />{trs("تقييم العملاء")}</span>
          <h2 id="rbh">⭐ {trs("رأيك يهمنا.. قيّم تجربتك مع دواك")}</h2>
          <p>{trs("شاركنا تقييمك وساعدنا نطور خدماتنا علشان نوصلك أسرع وأفضل.")}</p>
          {canWrite
            ? <button type="button" className="rb-btn" onClick={() => setOpen(true)}><Icon n="star" s={16} />{mine ? trs("عدّل تقييمك") : trs("قيّم دواك الآن")}</button>
            : !user ? <a className="rb-btn" href="#/login">{trs("سجّل دخولك وقيّم دواك")}</a>
              : <span className="rb-note">{trs("التقييم متاح لحسابات المرضى")}</span>}
        </div>
        <div className="rb-score" aria-label={rows.length ? trs("متوسط التقييم {0} من 5", [avg.toFixed(1)]) : trs("لسه مفيش تقييمات")}>
          <b className="rb-n">{rows.length ? avg.toFixed(1) : '—'}</b>
          <span className="rb-of">{trs("من 5")}</span>
          <Stars n={avg} size={17} />
          <span className="rb-c">{rows.length ? trs("{0} تقييم", [rows.length]) : trs("لسه مفيش تقييمات")}</span>
        </div>
      </section>
      {open && user && profile && <RateModal mine={mine} user={user} profile={profile} onClose={() => setOpen(false)} onDone={done} />}
    </>);
}
