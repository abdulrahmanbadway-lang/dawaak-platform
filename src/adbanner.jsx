import { useEffect, useRef, useState } from 'react';
import { Icon } from './icons.jsx';
import { toast } from './ui.jsx';
import { trs } from './lib/i18n.js';
import { loadContact, waLink } from './lib/site.js';
import './adbanner.css';

const PACKS = ['بانر رئيسي', 'قسم العروض', 'باقة كاملة'];
const WA = <svg viewBox="0 0 32 32" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M16.04 3C9.4 3 4 8.38 4 15.01c0 2.12.55 4.19 1.6 6.01L4 29l8.17-1.57a12.03 12.03 0 0 0 3.87.63C22.68 28.06 28 22.68 28 16.04 28 9.38 22.68 3 16.04 3zm0 22.04c-1.2 0-2.38-.3-3.42-.87l-.5-.27-4.85.93.96-4.7-.3-.5a9.02 9.02 0 0 1-1.34-4.62c0-4.98 4.07-9.03 9.05-9.03s9.03 4.05 9.03 9.03-4.05 9.03-9.03 9.03zm4.95-6.76c-.27-.14-1.6-.79-1.85-.88-.25-.09-.43-.14-.61.14-.18.27-.7.88-.86 1.06-.16.18-.32.2-.59.07-.27-.14-1.15-.42-2.2-1.35-.81-.72-1.36-1.62-1.52-1.89-.16-.27-.02-.42.12-.55.12-.12.27-.32.41-.48.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.14-.61-1.47-.84-2.01-.22-.53-.44-.46-.61-.47h-.52c-.18 0-.48.07-.73.34-.25.27-.95.93-.95 2.27s.98 2.64 1.11 2.82c.14.18 1.92 2.93 4.65 4.11.65.28 1.16.45 1.55.57.65.21 1.24.18 1.71.11.52-.08 1.6-.65 1.82-1.28.23-.63.23-1.17.16-1.28-.07-.11-.25-.18-.52-.32z" /></svg>;

// طلب إعلان: بيتبعت على واتساب (أو الإيميل) من بيانات التواصل اللي الأدمن ضافها، من غير ما نخزّن حاجة
function AdModal({ c, onClose }) {
  const [f, setF] = useState({ brand: '', phone: '', pack: PACKS[0] }), [err, setErr] = useState('');
  const ref = useRef(null);
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k); ref.current?.querySelector('input')?.focus();
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  const text = () => trs("طلب إعلان على دواك") + '\n' + trs("الشركة/الماركة") + ': ' + f.brand.trim() + '\n' + trs("الموبايل") + ': ' + f.phone.trim() + '\n' + trs("نوع الإعلان") + ': ' + trs(f.pack);
  const submit = (e) => {
    e.preventDefault();
    if (f.brand.trim().length < 2) return setErr(trs("اكتب اسم الشركة أو الماركة."));
    if (f.phone.replace(/\D/g, '').length < 8) return setErr(trs("اكتب رقم موبايل صحيح."));
    setErr('');
    if (c.whatsapp) window.open(waLink(c.whatsapp, text()), '_blank', 'noopener');
    else location.href = 'mailto:' + c.email + '?subject=' + encodeURIComponent(trs("طلب إعلان على دواك")) + '&body=' + encodeURIComponent(text());
    toast(trs("جهّزنا رسالة الطلب، ابعتها وفريقنا هيتواصل معاك."));
    onClose();
  };
  return (
    <div className="mo" role="dialog" aria-modal="true" aria-labelledby="adt" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card narrow ad-modal" ref={ref}>
        <button type="button" className="ad-x" onClick={onClose} aria-label={trs("إغلاق")}>×</button>
        <header className="ad-mh"><span className="ad-mi" aria-hidden="true"><Icon n="chat" s={20} /></span>
          <div><h3 id="adt">{trs("طلب إعلان للشركات والماركات")}</h3><p className="mu sm2">{trs("هتتحول لرسالة جاهزة تبعتها لفريق التسويق")}</p></div></header>
        <form className="ad-f" onSubmit={submit} noValidate>
          <label>{trs("اسم الشركة أو الماركة")}<input className="fi" maxLength={60} value={f.brand} onChange={(e) => setF({ ...f, brand: e.target.value })} placeholder={trs("مثال: شركة فارما للدواء")} /></label>
          <label>{trs("رقم الموبايل / واتساب")}<input className="fi" type="tel" dir="ltr" maxLength={15} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="01012345678" /></label>
          <label>{trs("نوع الإعلان")}<select className="fi" value={f.pack} onChange={(e) => setF({ ...f, pack: e.target.value })}>{PACKS.map((p) => <option key={p} value={p}>{trs(p)}</option>)}</select></label>
          {err && <p className="ad-err" role="alert">{err}</p>}
          <button className="ad-sub">{c.whatsapp ? trs("ابعت الطلب على واتساب") : trs("ابعت الطلب بالإيميل")}</button>
        </form>
      </div>
    </div>);
}

// بانر "أعلن معانا": بيظهر بس لو الأدمن ضاف واتساب أو إيميل للتواصل
export default function AdBanner() {
  const [c, setC] = useState(null), [open, setOpen] = useState(false);
  useEffect(() => { loadContact().then(setC); }, []);
  if (!c || !(c.whatsapp || c.email)) return null;
  return (
    <>
      <section className="ad-banner" aria-labelledby="adh">
        <div className="ad-copy">
          <span className="ad-badge">{trs("شركاء النجاح والماركات")} ✨</span>
          <h2 id="adh" className="ad-title">{trs("أعلن عن منتجاتك وشركتك على دواك")}</h2>
          <p className="ad-text">{trs("وصّل منتجاتك الطبية ومستحضرات التجميل لعملاء الصيدليات في كل المحافظات.")}</p>
        </div>
        <div className="ad-acts">
          <button type="button" className="ad-btn gold" onClick={() => setOpen(true)}><Icon n="store" s={18} />{trs("أعلن الآن")}</button>
          {c.whatsapp && <a className="ad-btn ghost" target="_blank" rel="noopener noreferrer" href={waLink(c.whatsapp, trs("مرحباً فريق دواك، نرغب في الاستفسار عن باقات الإعلانات وعرض منتجات شركتنا على المنصة."))}>{WA}{trs("واتساب")}</a>}
        </div>
      </section>
      {open && <AdModal c={c} onClose={() => setOpen(false)} />}
    </>);
}
