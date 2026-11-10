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
import { usePresence } from './lib/presence.js';

function useTheme() {
  const [t, setT] = useState(() => { try { return localStorage.getItem('dw_t') || 'light'; } catch { return 'light'; } });
  useEffect(() => { document.documentElement.dataset.theme = t; try { localStorage.setItem('dw_t', t); } catch { /* ignore */ } }, [t]);
  return [t, () => setT(t === 'dark' ? 'light' : 'dark')];
}
const navFor = (r) => {
  if (r === 'admin') return [['/', 'الرئيسية', 'home'], ['/admin', 'لوحة التحكم', 'shield']];
  if (r === 'pharmacy') return [['/', 'الرئيسية', 'home'], ['/pharmacy', 'لوحة الصيدلية', 'store']];
  if (r === 'courier') return [['/', 'الرئيسية', 'home'], ['/courier', 'توصيلاتي', 'truck']];
  const l = [['/', 'الرئيسية', 'home'], ['/search', 'ابحث عن دوا', 'search'], [r ? '/rx' : '/rx/new', r ? 'روشتاتي' : 'ارفع روشتة', 'rx']];
  if (r === 'patient') l.push(['/orders', 'طلباتي', 'bag']);
  return l;
};
const isOn = (path, h) => (h === '/' ? path === '/' : path.startsWith(h) || (h === '/orders' && path.startsWith('/track')));
function Header() {
  const { profile, logout } = useAuth();
  const { path } = useRoute();
  const [theme, toggle] = useTheme();
  const r = profile?.role, links = navFor(r);
  return (
    <>
      <div className="top" dir="ltr">Graduation Project 2027 · Al-Gazeera Academy · Class of 2027 Graduates</div>
      <header className="hd"><div className="w hdi">
        <a href="#/" className="brand"><img src="/assets/mark.png" alt="" /><img className="wd" src="/assets/word.png" alt="دواك" /></a>
        <nav className="dn" aria-label="التنقل الرئيسي">{links.map(([h, l, ic]) => <a key={h} href={'#' + h} className={isOn(path, h) ? 'on' : ''}><Icon n={ic} s={17} />{l}</a>)}</nav>
        <div className="ua">
          <button className="ic" onClick={toggle} aria-label="الوضع الليلي"><Icon n={theme === 'dark' ? 'sun' : 'moon'} s={18} /></button>
          {profile ? <><span className="av">{profile.name[0]}</span><span className="un">{profile.name}</span><button className="ic" aria-label="خروج" title="خروج" onClick={() => { logout(); go('/'); }}><Icon n="logout" s={18} /></button></>
            : <><a className="btn o sm" href="#/login">دخول</a><a className="btn sm" href="#/register">حساب جديد</a></>}
        </div>
      </div></header>
      <nav className="bn" aria-label="التنقل">{links.map(([h, l, ic]) => <a key={h} href={'#' + h} className={isOn(path, h) ? 'on' : ''}><Icon n={ic} s={22} /><span>{l}</span></a>)}</nav>
    </>
  );
}
const Footer = () => (
  <footer><div className="w fin">
    <div className="fbrand"><img src="/assets/full.png" alt="دواك" /><div><b>دواك · Dawaak</b><p className="mu sm2">منصة تربط صيدليات مصر: ابحث عن دواك، اعرف أقرب صيدلية، واطلبه.</p></div></div>
    <div className="fcol"><a href="#/search">ابحث عن دوا</a><a href="#/register?role=pharmacy">سجّل صيدليتك</a><a href="#/login">دخول</a></div>
    <div className="fcol sm2" dir="ltr"><span>Graduation Project 2027</span><span>Al-Gazeera Academy</span><span>Class of 2027 Graduates</span></div>
  </div><div className="w fnote">المحتوى إرشادي ولا يغني عن استشارة الطبيب. في الطوارئ اتصل بالإسعاف 123. بنسجّل عنوان IP والصفحة الحالية لأغراض الأمان والإحصاء.</div></footer>
);
function Need({ role }) {
  return <div className="card center"><h2>محتاج تسجّل دخول</h2><p className="mu">الصفحة دي مخصصة {{ pharmacy: 'للصيدليات', admin: 'لأدمن الموقع', courier: 'للمناديب (الصيدلية هي اللي بتعمل حسابك)' }[role] || 'للمرضى'}.</p>
    <div className="row g"><a className="btn" href="#/login">دخول</a>{role !== 'courier' && role !== 'admin' && <a className="btn o" href={'#/register?role=' + role}>حساب جديد</a>}</div></div>;
}
function Setup() {
  return <div className="w"><div className="card"><h2>⚙ إعداد Firebase مطلوب</h2>
    <p className="mu">المشروع شغال لكن لسه مش متوصل بـ Firebase. حط القيم دي في Vercel (Settings → Environment Variables) أو في ملف <b>.env.local</b> وأعد البناء:</p>
    <pre dir="ltr">VITE_FIREBASE_API_KEY{'\n'}VITE_FIREBASE_AUTH_DOMAIN{'\n'}VITE_FIREBASE_PROJECT_ID{'\n'}VITE_FIREBASE_APP_ID</pre>
    <p className="mu">الخطوات الكاملة في ملف README.md.</p></div></div>;
}
function Routes() {
  const { path, q } = useRoute();
  const { user, profile, loading } = useAuth();
  usePresence(!loading, user?.uid || null, path);
  if (!configured) return <><Header /><main><Setup /></main><Footer /></>;
  const role = profile?.role;
  let page;
  if (loading) page = <div className="center">جاري التحميل…</div>;
  else if (path === '/login' || path === '/register') page = <AuthPage mode={path.slice(1)} q={q} />;
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
export default function App() { return <AuthProvider><Routes /></AuthProvider>; }
