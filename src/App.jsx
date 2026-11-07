import { AuthProvider, useAuth } from './auth.jsx';
import { useRoute, go } from './router.js';
import { configured } from './firebase.js';
import Home from './pages/Home.jsx';
import AuthPage from './pages/AuthPage.jsx';
import Search from './pages/Search.jsx';
import PatientOrders from './pages/PatientOrders.jsx';
import PharmacyDash from './pages/PharmacyDash.jsx';

function Header() {
  const { profile, logout } = useAuth();
  const r = profile?.role;
  return (
    <header className="hd"><div className="w hdi">
      <a href="#/" className="brand"><img src="/assets/mark.png" alt="" /><img className="wd" src="/assets/word.png" alt="دواك" /></a>
      <nav>
        <a href="#/search">ابحث عن دوا</a>
        {r === 'patient' && <a href="#/orders">طلباتي</a>}
        {r === 'pharmacy' && <a href="#/pharmacy">لوحة الصيدلية</a>}
      </nav>
      <div className="ua">
        {profile ? <><span className="av">{profile.name[0]}</span><span className="un">{profile.name}</span><button className="btn o sm" onClick={() => { logout(); go('/'); }}>خروج</button></>
          : <><a className="btn o sm" href="#/login">دخول</a><a className="btn sm" href="#/register">حساب جديد</a></>}
      </div>
    </div></header>
  );
}
const Footer = () => (
  <footer><div className="w">
    <span>المحتوى إرشادي ولا يغني عن استشارة الطبيب. في الطوارئ اتصل بالإسعاف 123.</span>
    <span dir="ltr">Dawaak · Graduation Project 2027 · Al-Gazeera Academy · Class of 2027 Graduates</span>
  </div></footer>
);
function Need({ role }) {
  return <div className="card center"><h2>محتاج تسجّل دخول</h2><p className="mu">الصفحة دي مخصصة {role === 'pharmacy' ? 'للصيدليات' : 'للمرضى'}.</p>
    <div className="row g"><a className="btn" href="#/login">دخول</a><a className="btn o" href={'#/register?role=' + role}>حساب جديد</a></div></div>;
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
  else if (path === '/orders') page = role === 'patient' ? <PatientOrders /> : <Need role="patient" />;
  else if (path.startsWith('/pharmacy')) page = role === 'pharmacy' ? <PharmacyDash /> : <Need role="pharmacy" />;
  else page = <Home />;
  return <><Header /><main className="w">{page}</main><Footer /></>;
}
export default function App() { return <AuthProvider><Routes /></AuthProvider>; }
