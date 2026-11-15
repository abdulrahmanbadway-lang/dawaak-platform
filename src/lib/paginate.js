import { createElement as h, useCallback, useEffect, useMemo, useState } from 'react';
import { trs } from './i18n.js';

// تقسيم قايمة لصفحات. بيرجّع: pageItems, page, setPage, totalPages, total, hasPrev, hasNext
export function usePagination(items, pageSize = 24) {
  const [page, setPageRaw] = useState(1);
  const total = items ? items.length : 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const cur = Math.min(Math.max(1, page), totalPages);
  // لو القايمة قلّت (فلتر جديد) والصفحة الحالية بقت أكبر من العدد، نرجع لآخر صفحة موجودة
  useEffect(() => { if (page !== cur) setPageRaw(cur); }, [page, cur]);
  const setPage = useCallback((p) => setPageRaw(Math.min(Math.max(1, Math.floor(+p) || 1), totalPages)), [totalPages]);
  const pageItems = useMemo(() => (items || []).slice((cur - 1) * pageSize, cur * pageSize), [items, cur, pageSize]);
  return { pageItems, page: cur, setPage, totalPages, total, hasPrev: cur > 1, hasNext: cur < totalPages };
}

// أرقام الصفحات المختصرة: 1 … 4 5 6 … 20
const windowed = (page, total) => {
  const set = new Set([1, total, page - 1, page, page + 1]);
  const out = []; let prev = 0;
  [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b).forEach((n) => { if (n - prev > 1) out.push('…' + n); out.push(n); prev = n; });
  return out;
};

// شريط الصفحات (مكتوب بـ createElement عشان الملف .js مش .jsx). onChange(page) اختياري لو عايز تتحرك لفوق بعد التغيير.
export function PaginationBar({ page, totalPages, setPage, hasPrev, hasNext, onChange }) {
  if (!totalPages || totalPages <= 1) return null;
  const go = (p) => { setPage(p); if (onChange) onChange(p); };
  const btn = (key, label, p, opts = {}) => h('button', {
    key, type: 'button', className: 'pg-b' + (opts.on ? ' on' : ''), disabled: !!opts.off, 'aria-label': opts.aria, 'aria-current': opts.on ? 'page' : undefined, onClick: () => go(p),
  }, label);
  return h('nav', { className: 'pgbar', 'aria-label': trs("الصفحات") },
    btn('prev', trs("السابق"), page - 1, { off: !hasPrev, aria: trs("الصفحة السابقة") }),
    ...windowed(page, totalPages).map((n) => (typeof n === 'string' ? h('span', { key: n, className: 'pg-dots' }, '…') : btn(n, String(n), n, { on: n === page, aria: trs("صفحة") + ' ' + n }))),
    btn('next', trs("التالي"), page + 1, { off: !hasNext, aria: trs("الصفحة التالية") }));
}
