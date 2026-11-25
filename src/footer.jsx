import { useEffect, useState } from 'react';
import { useAuth } from './auth.jsx';
import { Icon } from './icons.jsx';
import { toast } from './ui.jsx';
import { trs } from './lib/i18n.js';
import { loadContact, telLink, waLink } from './lib/site.js';
import './footer.css';

const S = { viewBox: '0 0 24 24', width: 19, height: 19, fill: 'currentColor', 'aria-hidden': true };
const FB = <svg {...S}><path d="M13.5 21v-8h2.7l.4-3.2h-3.1V7.8c0-.9.3-1.5 1.6-1.5h1.7V3.4c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.5-4 4.1v2.4H7.7V13h2.7v8h3.1z" /></svg>;
const TG = <svg {...S}><path d="M20.7 4.2 3.4 10.9c-1.2.5-1.2 1.1-.2 1.4l4.4 1.4 1.7 5.2c.2.6.1.8.7.8.5 0 .7-.2 1-.5l2.1-2 4.4 3.3c.8.4 1.4.2 1.6-.8l2.9-13.7c.3-1.2-.4-1.7-1.3-1.3zM9 13.4l8.4-5.3c.4-.2.8-.1.5.2l-6.9 6.3-.3 3.1L9 13.4z" /></svg>;
const LK = <svg {...S} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>;
const WA = <svg {...S}><path d="M16.04 3C9.4 3 4 8.38 4 15.01c0 2.12.55 4.19 1.6 6.01L4 29l8.17-1.57a12.03 12.03 0 0 0 3.87.63C22.68 28.06 28 22.68 28 16.04 28 9.38 22.68 3 16.04 3zm0 22.04c-1.2 0-2.38-.3-3.42-.87l-.5-.27-4.85.93.96-4.7-.3-.5a9.02 9.02 0 0 1-1.34-4.62c0-4.98 4.07-9.03 9.05-9.03s9.03 4.05 9.03 9.03-4.05 9.03-9.03 9.03z" transform="scale(.75)" /></svg>;

// فوتر الموقع: عن دواك + روابط سريعة + دعم العملاء + مشاركة + شريط الدعم (قنوات التواصل اللي الأدمن ضافها)
export default function Footer() {
  const { profile } = useAuth(), r = profile?.role;
  const [c, setC] = useState(null);
  useEffect(() => { loadContact().then(setC); }, []);
  const quick = [['/', "الرئيسية"], ['/shop', "المتجر"], ['/search', "ابحث عن دوا"], ['/care', "رعايتك"]];
  if (r === 'patient') quick.push(['/orders', "طلباتي"]);
  if (r === 'pharmacy') quick.push(['/pharmacy', "لوحة الصيدلية"]);
  if (r === 'courier') quick.push(['/courier', "توصيلاتي"]);
  if (r === 'admin') quick.push(['/admin', "لوحة التحكم"]);
  const help = [[r === 'patient' ? '/rx' : '/rx/new', r === 'patient' ? "روشتاتي" : "ارفع روشتة"]];
  if (!r) help.push(['/login', "دخول"], ['/register', "حساب جديد"]);
  if (!r || r === 'patient') help.push(['/register?role=pharmacy', "سجّل صيدليتك"]);
  const url = typeof location === 'undefined' ? '' : location.href;
  const msg = encodeURIComponent(trs("اكتشف منصة دواك للأدوية والمنتجات الطبية"));
  const eu = encodeURIComponent(url);
  const copy = async () => { try { await navigator.clipboard.writeText(url); toast(trs("تم نسخ رابط الموقع ✓")); } catch { toast(trs("تعذّر النسخ")); } };
  const ch = c ? [c.whatsapp && ['wa', waLink(c.whatsapp, trs("مرحباً دواك، عندي استفسار")), trs("واتساب"), true], c.phone && ['tel', telLink(c.phone), trs("اتصال هاتفي")], c.email && ['mail', 'mailto:' + c.email, trs("راسلنا بالإيميل")]].filter(Boolean) : [];
  return (
    <footer className="ft">
      <div className="ft-main">
        <section className="ft-brand" aria-label={trs("عن دواك")}>
          <a className="ft-logo" href="#/"><img src="/assets/mark.png" alt="" /><span><strong>DAWAAK</strong><span>{trs("دواك")}</span></span></a>
          <h2>{trs("صحتك تهمنا، وراحتك هدفنا")}</h2>
          <p>{trs("منصة تربط صيدليات مصر: ابحث عن دواك، اعرف أقرب صيدلية، واطلبه.")}</p>
        </section>
        <nav className="ft-col" aria-label={trs("روابط سريعة")}><h2>{trs("روابط سريعة")}</h2><ul>{quick.map(([h, l]) => <li key={h}><a href={'#' + h}>{trs(l)}</a></li>)}</ul></nav>
        <nav className="ft-col" aria-label={trs("دعم العملاء")}><h2>{trs("دعم العملاء")}</h2><ul>{help.map(([h, l]) => <li key={h}><a href={'#' + h}>{trs(l)}</a></li>)}</ul></nav>
        <section className="ft-soc" aria-labelledby="ft-soc-t"><h2 id="ft-soc-t">{trs("تابعنا وشارك دواك")}</h2><p>{trs("يسعدنا أن تكون دواك جزءًا من يومك.")}</p>
          <div className="ft-links">
            <a href={'https://www.facebook.com/sharer/sharer.php?u=' + eu} target="_blank" rel="noopener noreferrer" aria-label={trs("مشاركة على فيسبوك")} title={trs("مشاركة على فيسبوك")}>{FB}</a>
            <a href={'https://wa.me/?text=' + msg + '%20' + eu} target="_blank" rel="noopener noreferrer" aria-label={trs("مشاركة على واتساب")} title={trs("مشاركة على واتساب")}>{WA}</a>
            <a href={'https://t.me/share/url?url=' + eu + '&text=' + msg} target="_blank" rel="noopener noreferrer" aria-label={trs("مشاركة على تيليجرام")} title={trs("مشاركة على تيليجرام")}>{TG}</a>
            <button type="button" onClick={copy} aria-label={trs("نسخ رابط الموقع")} title={trs("نسخ رابط الموقع")}>{LK}</button>
          </div></section>
      </div>
      <div className="ft-bot"><p dir="ltr">© 2026 DAWAAK · Graduation Project 2027 · Al-Gazeera Academy · Class of 2027 Graduates</p></div>
      {ch.length > 0 && <section className="ft-sup" aria-labelledby="ft-sup-t">
        <div className="ft-sc"><span className="ft-si" aria-hidden="true"><Icon n="chat" s={20} /></span>
          <div><h2 id="ft-sup-t">{trs("محتاج مساعدة في طلبك؟")}</h2><p>{trs("فريق الدعم متاح للرد على استفساراتك عن الطلبات والروشتات.")}</p></div></div>
        <div className="ft-sa">{ch.map(([k, h, l, ext], i) => <a key={k} className={'ft-sb' + (i ? ' gh' : '')} href={h} {...(ext ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{l}</a>)}</div>
      </section>}
      <p className="ft-note">{trs("المحتوى إرشادي ولا يغني عن استشارة الطبيب. في الطوارئ اتصل بالإسعاف 123. بنسجّل عنوان IP والصفحة الحالية والمنطقة التقريبية (لو سمحت بتحديد الموقع) لأغراض الأمان والإحصاء.")}</p>
    </footer>);
}
