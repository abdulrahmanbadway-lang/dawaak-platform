import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './auth.jsx';
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

function useTheme() {
  const [t, setT] = useState(() => { try { return localStorage.getItem('dw_t') || 'light'; } catch { return 'light'; } });
  useEffect(() => { document.documentElement.dataset.theme = t; try { localStorage.setItem('dw_t', t); } catch { /* ignore */ } }, [t]);
  return [t, () => setT(t === 'dark' ? 'light' : 'dark')];
}
function Header() {
  const { profile, logout } = useAuth();
  const [theme, toggle] = useTheme();
  const r = profile?.role;
  return (
    <>
      <div className="top" dir="ltr">Graduation Project 2027 · Al-Gazeera Academy · Class of 2027 Graduates</div>
      <header className="hd"><div className="w hdi">
        <a href="#/" className="brand"><img src="/assets/mark.png" alt="" /><img className="wd" src="/assets/word.png" alt="دواك" /></a>
        <nav>
          <a href="#/">الرئيسية</a>
          <a href="#/search">ابحث عن دوا</a>
          {(!r || r === 'patient') && <a href="#/rx/new">ارفع روشتة</a>}
          {r === 'patient' && <a href="#/rx">روشتاتي</a>}
          {r === 'patient' && <a href="#/orders">طلباتي</a>}
          {r === 'pharmacy' && <a href="#/pharmacy">لوحة الصيدلية</a>}
          {r === 'courier' && <a href="#/courier">توصيلاتي</a>}
        </nav>
        <div className="ua">
          <button className="ic" onClick={toggle} aria-label="الوضع الليلي">{theme === 'dark' ? '☀' : '☾'}</button>
          {profile ? <><span className="av">{profile.name[0]}</span><span className="un">{profile.name}</span><button className="btn o sm" onClick={() => { logout(); go('/'); }}>خروج</button></>
            : <><a className="btn o sm" href="#/login">دخول</a><a className="btn sm" href="#/register">حساب جديد</a></>}
        </div>
      </div></header>
    </>
  );
}
const Footer = () => (
  <footer><div className="w fin">
    <div className="fbrand"><img src="/assets/full.png" alt="دواك" /><div><b>دواك · Dawaak</b><p className="mu sm2">منصة تربط صيدليات مصر: ابحث عن دواك، اعرف أقرب صيدلية، واطلبه.</p></div></div>
    <div className="fcol"><a href="#/search">ابحث عن دوا</a><a href="#/register?role=pharmacy">سجّل صيدليتك</a><a href="#/login">دخول</a></div>
    <div className="fcol sm2" dir="ltr"><span>Graduation Project 2027</span><span>Al-Gazeera Academy</span><span>Class of 2027 Graduates</span></div>
  </div><div className="w fnote">المحتوى إرشادي ولا يغني عن استشارة الطبيب. في الطوارئ اتصل بالإسعاف 123.</div></footer>
);
function Need({ role }) {
  return <div className="card center"><h2>محتاج تسجّل دخول</h2><p className="mu">الصفحة دي مخصصة {{ pharmacy: 'للصيدليات', courier: 'للمناديب (الصيدلية هي اللي بتعمل حسابك)' }[role] || 'للمرضى'}.</p>
    <div className="row g"><a className="btn" href="#/login">دخول</a>{role !== 'courier' && <a className="btn o" href={'#/register?role=' + role}>حساب جديد</a>}</div></div>;
}
function Setup() {
  return <div className="w"><div className="card"><h2>⚙ إعداد Firebase مطلوب</h2>
    <p className="mu">المشروع شغال لكن لسه مش متوصل بـ Firebase. حط القيم دي في Vercel (Settings → Environment Variables) أو في ملف <b>.env.local</b> وأعد البناء:</p>
    <pre dir="ltr">VITE_FIREBASE_API_KEY{'\n'}VITE_FIREBASE_AUTH_DOMAIN{'\n'}VITE_FIREBASE_PROJECT_ID{'\n'}VITE_FIREBASE_APP_ID</pre>
    <p className="mu">الخطوات الكاملة في ملف README.md.</p></div></div>;
}
function Routes() {
  const { path, q } = useRoute();
  const { profile, loading } = useAuth();
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
  else if (path.startsWith('/pharmacy')) page = role === 'pharmacy' ? <PharmacyDash /> : <Need role="pharmacy" />;
  else page = <Home />;
  return <><Header /><main className="w">{page}</main><Footer /></>;
}
export default function App() { return <AuthProvider><Routes /></AuthProvider>; }
