import { useEffect, useRef, useState } from 'react';
import { collection, deleteDoc, doc, getDocs, limit, query, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase.js';
import { useAuth } from './auth.jsx';
import { Icon } from './icons.jsx';
import { toast } from './ui.jsx';
import { trs } from './lib/i18n.js';
import { loadContact, telLink, waLink } from './lib/site.js';
import './contact.css';

const MAIL = <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m4 7 8 6 8-6" /></svg>;
const WA = (
  <svg viewBox="0 0 32 32" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M16.04 3C9.4 3 4 8.38 4 15.01c0 2.12.55 4.19 1.6 6.01L4 29l8.17-1.57a12.03 12.03 0 0 0 3.87.63C22.68 28.06 28 22.7 28 16.07 28 9.4 22.7 3 16.04 3Zm0 22.03c-1.2 0-2.38-.3-3.42-.87l-.5-.27-4.85.93.96-4.7-.3-.5a9.02 9.02 0 0 1-1.4-4.8c0-4.96 4.06-9 9.04-9 4.96 0 9.02 4.04 9.02 9.04 0 4.96-4.04 9.17-8.55 9.17Zm5-6.76c-.27-.14-1.62-.8-1.87-.9-.25-.09-.43-.14-.62.14-.18.27-.7.9-.86 1.08-.16.18-.32.2-.6.07-.27-.14-1.15-.42-2.2-1.35-.8-.72-1.35-1.6-1.5-1.87-.16-.27-.02-.42.12-.55.12-.12.27-.32.4-.48.14-.16.18-.27.27-.45.1-.18.05-.34-.02-.48-.07-.14-.62-1.5-.85-2.05-.22-.54-.45-.46-.62-.47h-.52c-.18 0-.48.07-.73.34-.25.27-.96.94-.96 2.3s.98 2.67 1.12 2.85c.14.18 1.93 2.94 4.68 4.12.65.28 1.16.45 1.56.58.66.2 1.25.18 1.72.1.52-.08 1.62-.66 1.85-1.3.23-.64.23-1.19.16-1.3-.07-.12-.25-.2-.52-.34Z" /></svg>
);

// زر تواصل عائم: إيميل / واتساب / اتصال هاتفي (بيتعرض بس اللي الأدمن ضافه)
export function ContactFab() {
  const [c, setC] = useState(null), [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => { loadContact().then(setC); }, []);
  useEffect(() => {
    if (!open) return undefined;
    const f = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const k = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', f); document.addEventListener('keydown', k);
    return () => { document.removeEventListener('pointerdown', f); document.removeEventListener('keydown', k); };
  }, [open]);
  const rows = c ? [
    c.email && ['mail', trs("راسلنا بالإيميل"), c.email, 'mailto:' + c.email + '?subject=' + encodeURIComponent(trs("استفسار من موقع دواك"))],
    c.whatsapp && ['wa', trs("تواصل عبر واتساب"), c.whatsapp, waLink(c.whatsapp, trs("مرحباً دواك، عندي استفسار"))],
    c.phone && ['tel', trs("اتصال هاتفي"), c.phone, telLink(c.phone)],
  ].filter(Boolean) : [];
  // القيمة (الرقم/الإيميل) بتتستخدم في الرابط بس ومش بتتعرض في الواجهة
  if (!rows.length) return null;
  return (
    <div className="cfab" ref={ref}>
      {open && <div className="cpanel" role="dialog" aria-label={trs("تواصل معانا")}>
        <b>{trs("تواصل معانا")}</b><span className="mu sm2">{trs("اختار الطريقة اللي تناسبك")}</span>
        {rows.map(([k, l, , h]) => (
          <a key={k} className={'copt ' + k} href={h} {...(k === 'wa' ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
            <span className="ci">{k === 'wa' ? WA : k === 'mail' ? MAIL : <Icon n="phone" s={20} />}</span>
            <span className="ct"><b>{l}</b></span>
          </a>))}
      </div>}
      <button className="cbtn" onClick={() => setOpen((x) => !x)} aria-label={trs("تواصل معانا")} aria-expanded={open}><Icon n={open ? 'x' : 'chat'} s={26} /></button>
    </div>
  );
}

// شريط الأرقام (حقيقية من قاعدة البيانات)
export function CoverStrip({ stats }) {
  if (!stats) return null;
  const I = [[stats.pharmacies, "صيدلية موثّقة", 'store'], [stats.products, "منتج متاح", 'pill'], [stats.governorates, "محافظة بنغطيها", 'pin']];
  return (
    <section className="sec">
      <h2 className="ctr">{trs("بنغطي كل احتياجاتك من")}{" "}<span className="gr">{trs("الصيدلية")}</span></h2>
      <div className="cov">
        {I.map(([n, l, ic]) => <div key={l}><Icon n={ic} s={30} /><b>{n}</b><span>{trs(l)}</span></div>)}
        <a href="#/rx/new"><Icon n="chat" s={30} /><b>{trs("اسأل صيدلي")}</b><span>{trs("ارفع روشتتك والصيدلي يرد عليك")}</span></a>
      </div>
    </section>
  );
}

const Stars = ({ n, on }) => <span className="stars" aria-label={n + '/5'}>{[1, 2, 3, 4, 5].map((i) => <button type="button" key={i} className={i <= n ? 'on' : ''} onClick={on ? () => on(i) : undefined} tabIndex={on ? 0 : -1} aria-hidden={!on}><Icon n="star" s={on ? 26 : 16} /></button>)}</span>;
const dt = (t) => { try { const d = t && t.toDate ? t.toDate() : t; return d ? d.toLocaleDateString('ar-EG') : ''; } catch { return ''; } };

// آراء العملاء: المريض بيكتب رأيه (رأي واحد لكل حساب)، والأدمن بيقدر يحذف أي رأي مخالف
export function Reviews() {
  const { user, profile } = useAuth();
  const [rows, setRows] = useState(null), [f, setF] = useState({ rating: 5, text: '' }), [busy, setBusy] = useState(false), [form, setForm] = useState(false);
  const tr = useRef(null);
  const load = () => getDocs(query(collection(db, 'reviews'), limit(40)))
    .then((s) => setRows(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))))
    .catch(() => setRows([]));
  useEffect(() => { load(); }, []);
  const mine = user && rows ? rows.find((r) => r.id === user.uid) : null;
  const canWrite = user && profile?.role === 'patient';
  const open = () => { setF(mine ? { rating: mine.rating, text: mine.text } : { rating: 5, text: '' }); setForm(true); };
  const save = async (e) => {
    e.preventDefault();
    const text = f.text.trim();
    if (text.length < 5) return toast(trs("اكتب رأيك في جملة على الأقل"));
    setBusy(true);
    try {
      const name = profile.name.trim().split(/\s+/)[0].slice(0, 40);
      await setDoc(doc(db, 'reviews', user.uid), { name, rating: f.rating, text, createdAt: mine ? mine.createdAt : serverTimestamp(), updatedAt: serverTimestamp() });
      toast(trs("شكراً على رأيك ✓")); setForm(false); await load();
    } catch (x) { toast(trs("تعذر حفظ الرأي: ") + (x.code || x.message)); }
    setBusy(false);
  };
  const del = async () => { if (!confirm(trs("تحذف رأيك؟"))) return; try { await deleteDoc(doc(db, 'reviews', user.uid)); setForm(false); await load(); } catch (x) { toast(x.code || x.message); } };
  const slide = (d) => { const e = tr.current; if (e) e.scrollBy({ left: d * (e.clientWidth * 0.8), behavior: 'smooth' }); };
  if (rows === null) return null;
  return (
    <section className="sec">
      <div className="sech"><h2>{trs("رأي")}{" "}<span className="gr">{trs("عملائنا")}</span></h2>
        {rows.length > 1 && <div className="rvnav"><button className="ic" onClick={() => slide(1)} aria-label="→"><Icon n="back" s={18} /></button><button className="ic" onClick={() => slide(-1)} aria-label="←" style={{ transform: 'scaleX(-1)' }}><Icon n="back" s={18} /></button></div>}</div>
      {rows.length > 0 ? <div className="rvt" ref={tr}>{rows.map((r) => (
        <figure className="card rv" key={r.id}>
          <Stars n={r.rating} />
          <blockquote>{r.text}</blockquote>
          <figcaption><b>{r.name}</b><span className="mu sm2">{dt(r.createdAt)}</span></figcaption>
        </figure>))}</div>
        : <div className="card center"><p className="mu">{trs("لسه مفيش آراء. كن أول واحد يشاركنا رأيه.")}</p></div>}
      <div className="rvact">
        {canWrite && !form && <button className="btn o" onClick={open}>{mine ? trs("عدّل رأيك") : trs("اكتب رأيك")}</button>}
        {!user && <a className="btn o" href="#/login">{trs("سجّل دخولك عشان تكتب رأيك")}</a>}
        {user && !canWrite && <span className="mu sm2">{trs("الآراء بتتكتب من حسابات المرضى")}</span>}
      </div>
      {form && <form className="card rvf" onSubmit={save}>
        <b>{trs("تقييمك")}</b><Stars n={f.rating} on={(i) => setF((x) => ({ ...x, rating: i }))} />
        <textarea className="fi" rows={3} maxLength={300} value={f.text} onChange={(e) => setF((x) => ({ ...x, text: e.target.value }))} placeholder={trs("اكتب تجربتك مع دواك…")} />
        <div className="row g"><button className="btn" disabled={busy}>{busy ? '…' : trs("نشر")}</button><button type="button" className="btn o" onClick={() => setForm(false)}>{trs("إلغاء")}</button>{mine && <button type="button" className="btn o" onClick={del}>{trs("حذف رأيي")}</button>}</div>
        <p className="mu sm2">{trs("بيظهر اسمك الأول بس.")}</p>
      </form>}
    </section>
  );
}
