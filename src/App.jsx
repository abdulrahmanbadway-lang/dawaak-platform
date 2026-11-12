import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './auth.jsx';
import { Icon } from './icons.jsx';
import { useRoute, go } from './router.js';
import { configured } from './firebase.js';
import Home from './pages/Home.jsx';
import AuthPage from './pages/AuthPage.jsx';
import Search from './pages/Search.jsx';
import PatientOrders from './pages/PatientOrders.jsx';
import PharmacyDash from './pages/PharmacyDash.jsx';
import PatientRx from './pages/PatientRx.jsx';
import Track from './pages/Track.jsx';
import Courier from './pages/Courier.jsx';
import Admin from './pages/Admin.jsx';
import Shop from './pages/Shop.jsx';
import Product from './pages/Product.jsx';
import Cart from './pages/Cart.jsx';
import Brands from './pages/Brands.jsx';
import Drawer from './menu.jsx';
import { useCart, cartCount } from './lib/cart.js';
import { useFavs } from './lib/favs.js';
import { usePresence } from './lib/presence.js';
import Area from './pages/Area.jsx';
import { autoLocate } from './lib/where.js';
import { trs, useLang, setLang, applyLang } from './lib/i18n.js';
import './ltr.css';

function useTheme() {
  const [t, setT] = useState(() => { try { return localStorage.getItem('dw_t') || 'light'; } catch { return 'light'; } });
  useEffect(() => { document.documentElement.dataset.theme = t; try { localStorage.setItem('dw_t', t); } catch { /* ignore */ } }, [t]);
  return [t, () => setT(t === 'dark' ? 'light' : 'dark')];
}
const navFor = (r) => {
  if (r === 'admin') return [['/', trs("الرئيسية"), 'home'], ['/admin', trs("لوحة التحكم"), 'shield']];
  if (r === 'pharmacy') return [['/', trs("الرئيسية"), 'home'], ['/pharmacy', trs("لوحة الصيدلية"), 'store']];
  if (r === 'courier') return [['/', trs("الرئيسية"), 'home'], ['/courier', trs("توصيلاتي"), 'truck']];
  const l = [['/', trs("الرئيسية"), 'home'], ['/shop', trs("المتجر"), 'box'], ['/search', trs("ابحث عن دوا"), 'search'], [r ? '/rx' : '/rx/new', r ? trs("روشتاتي") : trs("ارفع روشتة"), 'rx']];
  if (r === 'patient') l.push(['/orders', trs("طلباتي"), 'bag']);
  return l;
};
const isOn = (path, h) => (h === '/' ? path === '/' : path.startsWith(h) || (h === '/orders' && path.startsWith('/track')));
function Header() {
  const { profile, logout } = useAuth();
  const { path } = useRoute();
  const [theme, toggle] = useTheme();
  const lang = useLang();
  const [menu, setMenu] = useState(false);
  const cart = useCart(), favs = useFavs(), cnt = cartCount(cart);
  const r = profile?.role, links = navFor(r), shopper = !r || r === 'patient';
  useEffect(() => { const f = () => setMenu(false); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return (
    <>
      <div className="top" dir="ltr">Graduation Project 2027 · Al-Gazeera Academy · Class of 2027 Graduates</div>
      <header className="hd"><div className="w hdi">
        <button className="ic mn" onClick={() => setMenu(true)} aria-label={trs("القائمة")}><Icon n="menu" s={20} /></button>
        <a href="#/" className="brand"><img src="/assets/mark.png" alt="" /><img className="wd" src="/assets/word.png" alt={trs("دواك")} /></a>
        <nav className="dn" aria-label={trs("التنقل الرئيسي")}>{links.map(([h, l, ic]) => <a key={h} href={'#' + h} className={isOn(path, h) ? 'on' : ''}><Icon n={ic} s={17} />{l}</a>)}</nav>
        <div className="ua">
          <button className="ic lng" onClick={() => setLang(lang === 'en' ? 'ar' : 'en')} aria-label={lang === 'en' ? 'التبديل إلى العربية' : 'Switch to English'} title={lang === 'en' ? 'العربية' : 'English'}>{lang === 'en' ? 'ع' : 'EN'}</button>
          {shopper && <a className="ic cb" href="#/shop?fav=1" aria-label={trs("المفضلة")}><Icon n="heart" s={18} />{favs.length > 0 && <i>{favs.length}</i>}</a>}
          {shopper && <a className="ic cb" href="#/cart" aria-label={trs("السلة")}><Icon n="cart" s={18} />{cnt > 0 && <i>{cnt}</i>}</a>}
          <button className="ic" onClick={toggle} aria-label={trs("الوضع الليلي")}><Icon n={theme === 'dark' ? 'sun' : 'moon'} s={18} /></button>
          {profile ? <><span className="av">{profile.name[0]}</span><span className="un">{profile.name}</span><button className="ic" aria-label={trs("خروج")} title={trs("خروج")} onClick={() => { logout(); go('/'); }}><Icon n="logout" s={18} /></button></>
            : <><a className="btn o sm" href="#/login">{trs("دخول")}</a><a className="btn sm" href="#/register">{trs("حساب جديد")}</a></>}
        </div>
      </div></header>
      {menu && <Drawer onClose={() => setMenu(false)} role={r} />}
      <nav className="bn" aria-label={trs("التنقل")}>{links.map(([h, l, ic]) => <a key={h} href={'#' + h} className={isOn(path, h) ? 'on' : ''}><Icon n={ic} s={22} /><span>{l}</span></a>)}</nav>
    </>
  );
}
const Footer = () => (
  <footer><div className="w fin">
    <div className="fbrand"><img src="/assets/full.png" alt={trs("دواك")} /><div><b>{trs("دواك · Dawaak")}</b><p className="mu sm2">{trs("منصة تربط صيدليات مصر: ابحث عن دواك، اعرف أقرب صيدلية، واطلبه.")}</p></div></div>
    <div className="fcol"><a href="#/search">{trs("ابحث عن دوا")}</a><a href="#/register?role=pharmacy">{trs("سجّل صيدليتك")}</a><a href="#/login">{trs("دخول")}</a></div>
    <div className="fcol sm2" dir="ltr"><span>Graduation Project 2027</span><span>Al-Gazeera Academy</span><span>Class of 2027 Graduates</span></div>
  </div><div className="w fnote">{trs("المحتوى إرشادي ولا يغني عن استشارة الطبيب. في الطوارئ اتصل بالإسعاف 123. بنسجّل عنوان IP والصفحة الحالية والمنطقة التقريبية (لو سمحت بتحديد الموقع) لأغراض الأمان والإحصاء.")}</div></footer>
);
function Need({ role }) {
  return <div className="card center"><h2>{trs("محتاج تسجّل دخول")}</h2><p className="mu">{trs("الصفحة دي مخصصة")}{" "}{{ pharmacy: trs("للصيدليات"), admin: trs("لأدمن الموقع"), courier: trs("للمناديب (الصيدلية هي اللي بتعمل حسابك)") }[role] || trs("للمرضى")}.</p>
    <div className="row g"><a className="btn" href="#/login">{trs("دخول")}</a>{role !== 'courier' && role !== 'admin' && <a className="btn o" href={'#/register?role=' + role}>{trs("حساب جديد")}</a>}</div></div>;
}
function Setup() {
  return <div className="w"><div className="card"><h2>{trs("⚙ إعداد Firebase مطلوب")}</h2>
    <p className="mu">{trs("المشروع شغال لكن لسه مش متوصل بـ Firebase. حط القيم دي في Vercel (Settings → Environment Variables) أو في ملف")}{" "}<b>.env.local</b> {trs("وأعد البناء:")}</p>
    <pre dir="ltr">VITE_FIREBASE_API_KEY{'\n'}VITE_FIREBASE_AUTH_DOMAIN{'\n'}VITE_FIREBASE_PROJECT_ID{'\n'}VITE_FIREBASE_APP_ID</pre>
    <p className="mu">{trs("الخطوات الكاملة في ملف README.md.")}</p></div></div>;
}
function Routes() {
  const { path, q } = useRoute();
  const lang = useLang();
  useEffect(() => { applyLang(path === '/admin'); }, [lang, path]);
  const { user, profile, loading } = useAuth();
  useEffect(() => { autoLocate(); }, []);
  usePresence(!loading, user?.uid || null, path);
  if (!configured) return <><Header /><main><Setup /></main><Footer /></>;
  const role = profile?.role;
  let page;
  if (loading) page = <div className="center">{trs("جاري التحميل…")}</div>;
  else if (path === '/login' || path === '/register') page = <AuthPage mode={path.slice(1)} q={q} />;
  else if (path === '/shop') page = <Shop key={q.toString()} q={q} />;
  else if (path.startsWith('/p/')) page = <Product id={path.slice(3)} />;
  else if (path === '/cart') page = <Cart />;
  else if (path === '/brands') page = <Brands />;
  else if (path === '/area') page = <Area key={q.toString()} q={q} />;
  else if (path === '/search') page = <Search key={q.toString()} q={q} />;
  else if (path === '/rx' || path === '/rx/new') page = role === 'patient' ? <PatientRx path={path} q={q} /> : <Need role="patient" />;
  else if (path === '/orders') page = role === 'patient' ? <PatientOrders /> : <Need role="patient" />;
  else if (path.startsWith('/track/')) page = role === 'patient' || role === 'pharmacy' ? <Track id={path.split('/')[2]} role={role} /> : <Need role="patient" />;
  else if (path === '/courier') page = role === 'courier' ? <Courier /> : <Need role="courier" />;
  else if (path === '/admin') page = role === 'admin' ? <Admin /> : <Need role="admin" />;
  else if (path.startsWith('/pharmacy')) page = role === 'pharmacy' ? <PharmacyDash /> : <Need role="pharmacy" />;
  else page = <Home />;
  return <><Header /><main className="w">{page}</main><Footer /></>;
}
function Root() { const lang = useLang(); return <Routes key={lang} />; }
export default function App() { return <AuthProvider><Root /></AuthProvider>; }
