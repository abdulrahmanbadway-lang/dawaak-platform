import { Icon } from './icons.jsx';
import { errMsg, errKind } from './lib/errors.js';
import { trs } from './lib/i18n.js';

// هياكل تحميل (skeleton) لكروت المنتجات: بتظهر مكان المنتجات لحد ما البيانات توصل
export function SkelCard() {
  return (
    <div className="rc skel" aria-hidden="true">
      <div className="sk sk-i"></div><div className="sk sk-l"></div><div className="sk sk-l s"></div><div className="sk sk-p"></div><div className="sk sk-b"></div>
    </div>
  );
}
// grid = شبكة المتجر (rgrid) / rail = شريط أفقي في الرئيسية / pgrid = شبكة البحث
export function SkelGrid({ n = 8, kind = 'rgrid' }) {
  return <div className={kind} role="status" aria-busy="true" aria-label="…">{Array.from({ length: n }, (_, i) => <SkelCard key={i} />)}</div>;
}
export function SkelRail({ title = true }) {
  return (
    <section className="sec rl" aria-busy="true">
      {title && <div className="sech"><div className="sk sk-h"></div></div>}
      <div className="rail">{Array.from({ length: 6 }, (_, i) => <SkelCard key={i} />)}</div>
    </section>
  );
}

// حالة "مفيش نتايج": أيقونة + عنوان + شرح + أزرار (إعادة ضبط الفلاتر مثلاً)
export function EmptyState({ icon = 'search', title, text, children }) {
  return (
    <div className="card empty-s" role="status">
      <span className="eic"><Icon n={icon} s={30} /></span>
      <h3>{title}</h3>
      {text && <p className="mu">{text}</p>}
      {children && <div className="row g wrap">{children}</div>}
    </div>
  );
}

// حالة الخطأ في تحميل بيانات: رسالة مفهومة + زر إعادة المحاولة (error = الاستثناء نفسه)
export function ErrorState({ error, onRetry, title }) {
  const k = errKind(error);
  return (
    <div className="card empty-s" role="alert">
      <span className="eic"><Icon n={k === 'net' ? 'bolt' : 'shield'} s={30} /></span>
      <h3>{title || (k === 'perm' ? trs("مفيش صلاحية") : k === 'net' ? trs("مشكلة في الاتصال") : trs("تعذر تحميل البيانات"))}</h3>
      <p className="mu">{errMsg(error)}</p>
      {onRetry && <div className="row g wrap"><button className="btn" onClick={onRetry}>{trs("إعادة المحاولة")}</button></div>}
    </div>
  );
}
