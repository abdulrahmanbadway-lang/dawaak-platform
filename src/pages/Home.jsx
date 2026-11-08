import { useEffect, useState } from 'react';
import { loadHome } from '../lib/featured.js';
import { ProdCard, PharmCard, goSearch } from '../components.jsx';

const FAQ = [
  ['هل دواك بديل للدكتور؟', 'لا. دواك بيساعدك تلاقي الدوا وتطلبه، لكن التشخيص والعلاج عند الطبيب. وفي الطوارئ اتصل بالإسعاف 123.'],
  ['إزاي الصيدلية تنضم للمنصة؟', 'سجّل حساب صيدلية، وضيف بيانات الترخيص والموقع، وابدأ ارفع أدويتك وأسعارك وصورها. بعد التحقق من الترخيص بتبقى صيدلية موثّقة.'],
  ['إزاي أعرف أقرب صيدلية عندها الدوا؟', 'ابحث باسم الدوا أو المادة الفعالة واضغط "استخدم موقعي"، وهنرتب لك الصيدليات بالأقرب، واللي الدوا متاح فيها الأول.'],
  ['طرق الدفع والتوصيل؟', 'الدفع عند الاستلام حالياً، والتوصيل من الصيدلية اللي اخترتها.'],
];
const STEPS = [['🔎', 'ابحث عن الدوا', 'اكتب اسم الدوا أو المادة الفعالة.'], ['📍', 'قارن الصيدليات', 'مرتبة بالأقرب، مع السعر والتوافر.'], ['🛒', 'اطلب بضغطة', 'اختار الكمية وأكمل الطلب من صيدلية واحدة.'], ['🚚', 'تابع طلبك', 'من التحضير لحد التسليم لحظة بلحظة.']];

export default function Home() {
  const [q, setQ] = useState('');
  const [h, setH] = useState(null);
  useEffect(() => { loadHome().then(setH).catch(() => setH({ pharmacies: [], products: [], stats: null })); }, []);
  const prods = h?.products || [], phs = h?.pharmacies || [];
  const fp = prods[0], fph = phs.find((x) => x.open) || phs[0];
  const chips = (prods.length ? prods.slice(0, 5).map((p) => p.name) : ['بنادول', 'فيتامين سي', 'بروفين']);
  return (
    <div className="home">
      <section className="hero2">
        <div>
          <span className="tag"><i></i>منصة تربط صيدليات مصر</span>
          <h1 className="h1x">الدوا اللي محتاجه… <span className="gr">في أقرب صيدلية ليك.</span></h1>
          <p className="lead">اكتب اسم الدوا وشوف مين من الصيدليات القريبة عندها، بسعره وتفاصيله، واطلبه لحد بيتك.</p>
          <form className="sb" onSubmit={(e) => { e.preventDefault(); goSearch(q); }}>
            <span className="sic">⌕</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="اسم الدوا أو المادة الفعالة… مثلاً بنادول" />
            <button className="btn">ابحث</button>
          </form>
          <div className="qchips"><span className="mu sm2">الأكثر بحثاً:</span>{chips.map((c) => <button key={c} onClick={() => goSearch(c)}>{c}</button>)}</div>
          {h?.stats && <div className="st">
            <div><b>{h.stats.pharmacies}</b><span>صيدلية على المنصة</span></div>
            <div><b>{h.stats.products}</b><span>منتج ومستلزم</span></div>
            <div><b>{h.stats.governorates}</b><span>محافظات</span></div>
          </div>}
        </div>
        <div className="vis">
          <div className="arch"></div>
          <div className="lgo"><img src="/assets/mark.png" alt="" /></div>
          <div className="fc f1"><span className="mu">{fph ? fph.governorate : 'أقرب صيدلية'}</span><b>{fph ? fph.name : 'صيدلية قريبة منك'}</b><span className="bd ok">{fph?.open === false ? 'مغلقة حالياً' : 'مفتوحة الآن'}</span></div>
          <div className="fc f2"><span className="mu">{fp ? 'متاح الآن' : 'ابحث عن دواك'}</span><b>{fp ? fp.name : 'اسم الدوا'}</b><span className="ok">{fp ? (fp.min === fp.max ? fp.min : 'من ' + fp.min) + ' ج.م' : 'السعر والتوافر'}</span></div>
          <div className="fc f3"><b>🚚 تتبّع طلبك</b><div className="msteps"><i className="on"></i><i className="on"></i><i></i><i></i></div><span className="mu">قيد التحضير</span></div>
        </div>
      </section>

      <section className="sec">
        <h2>إزاي <span className="gr">دواك</span> بيشتغل؟</h2>
        <div className="how">{STEPS.map(([i, t, d], k) => <div className="card" key={k}><div className="hn">{i}</div><h3>{t}</h3><p className="mu">{d}</p></div>)}</div>
      </section>

      <section className="sec">
        <div className="sech"><h2>منتجات <span className="gr">متاحة الآن</span></h2><a className="go" href="#/search">تصفح كل المنتجات ◂</a></div>
        {h === null && <div className="pgrid">{[1, 2, 3, 4].map((i) => <div className="pcard sk" key={i}></div>)}</div>}
        {h && !prods.length && <div className="card center"><h3>لسه مفيش منتجات</h3><p className="mu">أول ما الصيدليات تضيف أدويتها هتظهر هنا.</p><a className="btn" href="#/register?role=pharmacy">سجّل صيدليتك</a></div>}
        {prods.length > 0 && <div className="pgrid">{prods.slice(0, 8).map((p) => <ProdCard key={p.name} p={p} />)}</div>}
      </section>

      {phs.length > 0 && <section className="sec">
        <div className="sech"><h2>صيدليات <span className="gr">على دواك</span></h2></div>
        <div className="phgrid">{phs.slice(0, 6).map((p) => <PharmCard key={p.id} p={p} />)}</div>
      </section>}

      <section className="sec">
        <h2>أمانك <span className="gr">أولاً</span></h2>
        <div className="how t3">
          <div className="card"><div className="hn">✚</div><h3>صيدليات بترخيص</h3><p className="mu">كل صيدلية بنتحقق من ترخيصها وبتظهر بعلامة "موثّقة".</p></div>
          <div className="card"><div className="hn">◆</div><h3>خصوصية بياناتك</h3><p className="mu">بياناتك ومعلومات طلباتك مبتتشاركش مع أي طرف تاني.</p></div>
          <div className="card"><div className="hn">✓</div><h3>أدوية الروشتة بمراجعة</h3><p className="mu">الأدوية اللي بتحتاج روشتة بتتطلب بمراجعة صيدلي مرخّص.</p></div>
        </div>
      </section>

      <section className="sec">
        <h2>أسئلة <span className="gr">شائعة</span></h2>
        <div className="faq">{FAQ.map(([a, b]) => <details className="card" key={a}><summary>{a}</summary><p className="mu">{b}</p></details>)}</div>
      </section>

      <section className="band">
        <div><h2>عندك صيدلية؟ انضم لدواك</h2><p>سجّل صيدليتك، وارفع أدويتك وأسعارك، واستقبل طلبات المرضى القريبين منك.</p></div>
        <a className="btn g" href="#/register?role=pharmacy">سجّل صيدليتك مجاناً</a>
      </section>
    </div>
  );
}
