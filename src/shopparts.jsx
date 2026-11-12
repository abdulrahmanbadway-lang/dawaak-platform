import { Icon } from './icons.jsx';
import { toast } from './ui.jsx';
import { tdata, trs, pharmWord } from './lib/i18n.js';
import { addToCart, needsSwitch, clearCart } from './lib/cart.js';
import { toggleFav, useFavs } from './lib/favs.js';

export const pHref = (g) => '#/p/' + encodeURIComponent(g.key || g.name);

// بيضيف عرض (منتج عند صيدلية معيّنة) للسلة، ويسأل لو السلة فيها صيدلية تانية
export function addOffer(p, phName) {
  if (needsSwitch(p.pharmacyId)) {
    if (!confirm(trs("الطلب بيكون من صيدلية واحدة بس. تفريغ السلة الحالية وإضافة المنتج ده؟"))) return false;
    clearCart();
  }
  const r = addToCart(p, phName);
  if (r === 'max') { toast(trs("الكمية المتاحة ") + p.stock + trs(" فقط")); return false; }
  toast(trs("اتضاف للسلة ✓"));
  return true;
}
const cheapest = (g) => g.offers.filter((o) => o.stock > 0).sort((a, b) => a.price - b.price)[0];

export function FavBtn({ name, cls = '' }) {
  const favs = useFavs(), on = favs.includes(name);
  return <button type="button" className={'fav ' + cls + (on ? ' on' : '')} aria-pressed={on} aria-label={trs("المفضلة")} onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFav(name); }}><Icon n="heart" s={18} /></button>;
}

// كارت منتج مجمّع (اسم واحد عند أكتر من صيدلية)
export function PCard({ g, phs }) {
  const o = cheapest(g);
  return (
    <div className="rc pc">
      <a className="rc-i" href={pHref(g)}>{g.imageUrl ? <img src={g.imageUrl} alt={g.name} loading="lazy" /> : <Icon n="pill" s={40} />}{g.off > 0 && <em className="off">-{g.off}%</em>}</a>
      <FavBtn name={g.name} />
      <a className="rc-n" href={pHref(g)}>{g.name}</a>
      <small className="mu">{[tdata(g.dose), tdata(g.form)].filter(Boolean).join(' · ')}</small>
      <span className="rc-p">{g.min === g.max ? g.min : trs("من ") + g.min} <small>{trs("ج.م")}</small>{g.off > 0 && <del>{g.oldMax}</del>}</span>
      <small className="mu">{trs("متاح في")}{" "}{g.count} {pharmWord(g.count)}</small>
      {o && <button type="button" className="btn sm" onClick={() => addOffer(o, phs?.[o.pharmacyId]?.name)}><Icon n="plus" s={14} /> {trs("أضف للسلة")}</button>}
    </div>
  );
}
