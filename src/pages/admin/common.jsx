// أدوات مشتركة بين تبويبات لوحة الأدمن (دوال تنسيق، هوكس، ومكوّنات صغيرة)
import { useEffect, useState } from 'react';
import { Icon } from '../../icons.jsx';

export const ON_MS = 120000, RECENT_MS = 15 * 60000, STALE_MS = 24 * 3600000;
export const ms = (t) => (t && typeof t.toMillis === 'function' ? t.toMillis() : typeof t === 'number' ? t : null);
export const ROLE = { patient: 'مريض', pharmacy: 'صيدلية', courier: 'مندوب', admin: 'أدمن' };
export const ST = { new: 'جديد', preparing: 'قيد التحضير', out: 'في الطريق', done: 'تم التسليم', cancelled: 'ملغي' };
export const ST_C = { new: 'am', cancelled: 'rd' };
export const PAGES = [['/search', 'البحث عن دوا'], ['/orders', 'طلباتي'], ['/rx', 'الروشتات'], ['/pharmacy', 'لوحة الصيدلية'], ['/courier', 'صفحة المندوب'], ['/track', 'تتبع طلب'], ['/login', 'تسجيل الدخول'], ['/register', 'إنشاء حساب'], ['/admin', 'لوحة التحكم']];
export const pageName = (p = '/') => (p === '/' ? 'الرئيسية' : (PAGES.find(([k]) => p.startsWith(k)) || [0, p])[1]);
export const ago = (t, now) => {
  if (!t) return '—';
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 45) return 'الآن';
  if (s < 3600) return 'قبل ' + Math.round(s / 60) + ' د';
  if (s < 86400) return 'قبل ' + Math.round(s / 3600) + ' س';
  return new Date(t).toLocaleDateString('en-GB');
};
export const dt = (t) => (t ? new Date(t).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
export const money = (n) => (Math.round(n) || 0).toLocaleString('en-US') + ' ج.م';
export const dayKey = (t) => new Date(t).toDateString();
export function csvText(rows) {
  const esc = (v) => { let s = String(v ?? ''); if (/^[=+\-@]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  return '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n');
}
export function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}
export function useNow(step) {
  const [n, setN] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setN(Date.now()), step); return () => clearInterval(t); }, [step]);
  return n;
}
export const Kpi = ({ ic, tone = '', v, l, sub }) => (
  <div className="adm-k"><i className={'adm-ki ' + tone}><Icon n={ic} s={22} /></i><div><b>{v}</b><span>{l}</span>{sub && <small>{sub}</small>}</div></div>
);
export const Empty = ({ children }) => <div className="adm-empty">{children}</div>;
export const Dot = ({ on }) => <i className={'adm-dot' + (on ? ' on' : '')} title={on ? 'متصل الآن' : 'غير متصل'} />;
// ───── المناطق: مين فين، وعايزين إيه (بيانات تقريبية: المحافظة + إحداثيات متقرّبة لحوالي 1 كم، وبس للي سمح بالموقع) ─────
export const topN = (m, n = 8) => Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n);

// ───── نافذة تأكيد موحّدة بدل confirm() ─────
// askConfirm({ title, text, ok, danger, type }) → Promise<boolean>. type = كلمة لازم المستخدم يكتبها عشان الإجراء الخطير يتنفّذ.
let confirmSet = null;
export const askConfirm = (o) => new Promise((res) => { if (confirmSet) confirmSet({ ...o, res }); else res(window.confirm((o.title || '') + '\n' + (o.text || ''))); });
export function ConfirmHost() {
  const [o, setO] = useState(null), [typed, setTyped] = useState('');
  useEffect(() => { confirmSet = (x) => { setTyped(''); setO(x); }; return () => { confirmSet = null; }; }, []);
  useEffect(() => {
    if (!o) return undefined;
    const k = (e) => { if (e.key === 'Escape') done(false); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }); // eslint-disable-line
  if (!o) return null;
  const done = (v) => { o.res(v); setO(null); };
  const okOff = o.type && typed.trim() !== o.type;
  return (
    <div className="adm-ov" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) done(false); }}>
      <div className="adm-dlg" role="alertdialog" aria-modal="true" aria-label={o.title}>
        <h3>{o.title}</h3>
        {o.text && <p className="mu" style={{ whiteSpace: 'pre-line' }}>{o.text}</p>}
        {o.type && <div className="fd"><label>اكتب <b>{o.type}</b> للتأكيد</label><input className="fi" autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} /></div>}
        <div className="row g end">
          <button className="btn o sm" onClick={() => done(false)}>إلغاء</button>
          <button className={'btn sm' + (o.danger ? ' dg' : '')} disabled={okOff} onClick={() => done(true)}>{o.ok || 'تأكيد'}</button>
        </div>
      </div>
    </div>
  );
}

// نافذة تفاصيل (طلب، روشتة…)
export function Modal({ title, onClose, children }) {
  useEffect(() => { const k = (e) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  return (
    <div className="adm-ov" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="adm-dlg wide" role="dialog" aria-modal="true" aria-label={title}>
        <div className="row between g"><h3>{title}</h3><button className="btn o sm" onClick={onClose} aria-label="إغلاق">إغلاق</button></div>
        {children}
      </div>
    </div>
  );
}

// هيكل جدول أثناء التحميل (داخل التبويب نفسه)
export const TableSkel = ({ rows = 6 }) => (
  <div className="card adm-tw adm-skt" role="status" aria-busy="true" aria-label="جاري التحميل">
    {Array.from({ length: rows }, (_, i) => <div key={i} className="adm-skr"><i className="sk" /><i className="sk" /><i className="sk" /><i className="sk" /></div>)}
  </div>
);

// شريط ملخّص صغير: [[label, value, tone?]]
export const Chips = ({ items }) => <div className="adm-chips">{items.filter(Boolean).map(([l, v, t]) => <span key={l} className={t || ''}>{l}: <b>{v}</b></span>)}</div>;

// أزرار تبديل سريعة للفلاتر: opts = [[value,label,count?]]
export const Seg = ({ v, on, opts }) => (
  <div className="adm-seg" role="group">{opts.map(([k, l, n]) => <button key={k} className={v === k ? 'on' : ''} onClick={() => on(k)}>{l}{n != null ? ` (${n})` : ''}</button>)}</div>
);
