import { useState } from 'react';
import { Icon } from './icons.jsx';
import { TREE } from './lib/cats.js';
import { trs } from './lib/i18n.js';

// القائمة الجانبية: كل الأقسام (مع الأقسام الفرعية) + روابط سريعة
export default function Drawer({ onClose, role }) {
  const [open, setOpen] = useState('');
  const L = (href, ic, t) => <a className="dw-l" href={href} onClick={onClose}><Icon n={ic} s={18} />{t}</a>;
  return (
    <div className="dw-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="dw" role="dialog" aria-label={trs("القائمة")}>
        <div className="row between"><b className="dw-t">{trs("القائمة")}</b><button className="ic" onClick={onClose} aria-label={trs("إغلاق")}><Icon n="x" s={18} /></button></div>
        {L('#/', 'home', trs("الرئيسية"))}
        {L('#/shop', 'box', trs("كل المنتجات"))}
        {L('#/shop?offers=1', 'bolt', trs("العروض"))}
        {L('#/brands', 'star', trs("الماركات"))}
        {L(role ? '#/rx' : '#/rx/new', 'rx', role === 'patient' ? trs("روشتاتي") : trs("ارفع روشتة"))}
        {role === 'patient' && L('#/orders', 'bag', trs("طلباتي"))}
        {L('#/shop?fav=1', 'heart', trs("المفضلة"))}
        <b className="dw-h">{trs("الأقسام")}</b>
        {TREE.map((t) => (
          <div key={t.k}>
            <button className="dw-c" onClick={() => setOpen(open === t.k ? '' : t.k)} aria-expanded={open === t.k}>{trs(t.k)}<Icon n="chevd" s={16} /></button>
            {open === t.k && <div className="dw-s"><a href={'#/shop?cat=' + encodeURIComponent(t.k)} onClick={onClose}>{trs("كل")} {trs(t.k)}</a>{t.subs.map((s) => <a key={s} href={'#/shop?cat=' + encodeURIComponent(t.k) + '&sub=' + encodeURIComponent(s)} onClick={onClose}>{trs(s)}</a>)}</div>}
          </div>))}
        <b className="dw-h">{trs("للصيدليات")}</b>
        {L('#/register?role=pharmacy', 'store', trs("عندك صيدلية؟ انضم لدواك"))}
      </aside>
    </div>
  );
}
