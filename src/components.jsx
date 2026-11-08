import { go } from './router.js';
import { Badge } from './ui.jsx';

export function ProdCard({ p }) {
  return (
    <a className="pcard" href={'#/search?q=' + encodeURIComponent(p.name)}>
      <div className="pimg">{p.imageUrl ? <img src={p.imageUrl} alt={p.name} loading="lazy" /> : <span>💊</span>}</div>
      <h3>{p.name}</h3>
      <p className="mu sm2">{[p.dose, p.form].filter(Boolean).join(' · ')}</p>
      <div className="prow"><b className="price">{p.min === p.max ? p.min : 'من ' + p.min} <small>ج.م</small></b><Badge c="ok">متاح في {p.count} {p.count > 2 ? 'صيدليات' : 'صيدلية'}</Badge></div>
      <span className="go">اعرف أقرب صيدلية ◂</span>
    </a>
  );
}
export function PharmCard({ p }) {
  return (
    <div className="phc">
      <div className="phi">🏪</div>
      <div className="phb">
        <h3>{p.name}</h3>
        <p className="mu sm2">{p.governorate} · {p.address}</p>
        <p className="sm2">{p.hours ? '🕘 ' + p.hours : ''}</p>
        <div className="brow">{p.verified ? <Badge c="ok">موثّقة</Badge> : <Badge c="am">قيد التوثيق</Badge>} <Badge c={p.open ? 'ok' : 'rd'}>{p.open ? 'مفتوحة' : 'مغلقة'}</Badge></div>
      </div>
    </div>
  );
}
export const goSearch = (q) => go('/search?q=' + encodeURIComponent(q));
