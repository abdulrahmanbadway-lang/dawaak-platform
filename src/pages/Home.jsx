import { useState } from 'react';
import { go } from '../router.js';

export default function Home() {
  const [q, setQ] = useState('');
  return (
    <div className="home">
      <section className="hero">
        <span className="tag">● منصة تربط صيدليات مصر</span>
        <h1>الدوا اللي محتاجه… <span className="gr">في أقرب صيدلية ليك.</span></h1>
        <p className="lead">اكتب اسم الدوا وشوف مين من الصيدليات القريبة عندها، بسعره وتفاصيله، واطلبه لحد بيتك.</p>
        <form className="sb" onSubmit={(e) => { e.preventDefault(); go('/search?q=' + encodeURIComponent(q)); }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="اسم الدوا أو المادة الفعالة… مثلاً بنادول" />
          <button className="btn">ابحث</button>
        </form>
      </section>
      <section className="grid3">
        <div className="card"><div className="ic">🔎</div><h3>ابحث وقارن</h3><p className="mu">نتايج من كل الصيدليات مرتبة بالأقرب، مع السعر والتوافر.</p></div>
        <div className="card"><div className="ic">🛒</div><h3>اطلب بسهولة</h3><p className="mu">اطلب من الصيدلية اللي تناسبك وتابع حالة الطلب لحظة بلحظة.</p></div>
        <div className="card"><div className="ic">🏪</div><h3>صيدليتك على دواك</h3><p className="mu">سجّل صيدليتك، وارفع أدويتك وأسعارك وصورها، واستقبل الطلبات.</p>
          <a className="btn sm" href="#/register?role=pharmacy">سجّل صيدليتك</a></div>
      </section>
    </div>
  );
}
