import { useEffect, useState } from 'react';
import { loadHome, loadCatalog } from '../lib/featured.js';
import { Icon } from '../icons.jsx';
import { ProdCard, PharmCard, goSearch } from '../components.jsx';
import { trs } from '../lib/i18n.js';
import { Banners, CatTiles, Rails, OffersRail, BrandsRow } from '../homeparts.jsx';
import { CoverStrip, Reviews } from '../contact.jsx';
import { WhereChip, NearSection, HeroNear, Radar } from '../areas.jsx';

const FAQ = [
  ['هل دواك بديل للدكتور؟', 'لا. دواك بيساعدك تلاقي الدوا وتطلبه، لكن التشخيص والعلاج عند الطبيب. وفي الطوارئ اتصل بالإسعاف 123.'],
  ['إزاي الصيدلية تنضم للمنصة؟', 'سجّل حساب صيدلية، وضيف بيانات الترخيص والموقع، وابدأ ارفع أدويتك وأسعارك وصورها. وبعد ما نراجع المستندات والترخيص بتظهر صيدليتك للمرضى.'],
  ['إزاي أعرف أقرب صيدلية عندها الدوا؟', 'ابحث باسم الدوا أو المادة الفعالة واضغط "استخدم موقعي"، وهنرتب لك الصيدليات بالأقرب، واللي الدوا متاح فيها الأول.'],
  ['طرق الدفع والتوصيل؟', 'الدفع عند الاستلام حالياً، والتوصيل من الصيدلية اللي اخترتها.'],
];
const STEPS = [['search', 'ابحث عن الدوا', 'اكتب اسم الدوا أو المادة الفعالة.'], ['pin', 'قارن الصيدليات', 'مرتبة بالأقرب، مع السعر والتوافر.'], ['bag', 'اطلب بضغطة', 'اختار الكمية وأكمل الطلب من صيدلية واحدة.'], ['truck', 'تابع طلبك', 'من التحضير لحد التسليم لحظة بلحظة.']];

export default function Home() {
  const [q, setQ] = useState('');
  const [h, setH] = useState(null);
  const [cat, setCat] = useState(null);
  useEffect(() => { loadHome().then(setH).catch(() => setH({ pharmacies: [], products: [], stats: null })); loadCatalog().then(setCat).catch(() => {}); }, []);
  const prods = h?.products || [], shop = cat?.products || [], phs = h?.pharmacies || [];
  const allPhs = phs.length ? phs : Object.values(cat?.pharmacies || {});
  const fp = prods[0];
  const chips = prods.slice(0, 5).map((p) => p.name); // أسماء حقيقية من المنتجات المتاحة فعلاً
  return (
    <div className="home">
      <section className="hero2">
        <div>
          <span className="tag"><i></i>{trs("منصة تربط صيدليات مصر")}</span>
          <h1 className="h1x">{trs("الدوا اللي محتاجه…")}{" "}<span className="gr">{trs("في أقرب صيدلية ليك.")}</span></h1>
          <p className="lead">{trs("اكتب اسم الدوا وشوف مين من الصيدليات القريبة عندها، بسعره وتفاصيله، واطلبه لحد بيتك.")}</p>
          <form className="sb" onSubmit={(e) => { e.preventDefault(); goSearch(q); }}>
            <span className="sic">⌕</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={trs("اسم الدوا أو المادة الفعالة… مثلاً بنادول")} />
            <button className="btn">{trs("ابحث")}</button>
          </form>
          <WhereChip phs={cat?.pharmacies ? Object.values(cat.pharmacies) : phs} />
          {chips.length > 0 && <div className="qchips"><span className="mu sm2">{trs("متاح الآن:")}</span>{chips.map((c) => <button key={c} onClick={() => goSearch(c)}>{c}</button>)}</div>}
          {h?.stats && <div className="st">
            <div><b>{h.stats.pharmacies}</b><span>{trs("صيدلية على المنصة")}</span></div>
            <div><b>{h.stats.products}</b><span>{trs("منتج ومستلزم")}</span></div>
            <div><b>{h.stats.governorates}</b><span>{trs("محافظات فيها صيدليات")}</span></div>
          </div>}
        </div>
        <div className="vis">
          <div className="arch"></div>
          <Radar />
          <div className="lgo"><img src="/assets/mark.png" alt="" /></div>
          <HeroNear phs={allPhs} />
          {fp && <div className="fc f2"><span className="mu">{trs("متاح الآن")}</span><b>{fp.name}</b><span className="ok">{(fp.min === fp.max ? fp.min : trs("من ") + fp.min) + trs(" ج.م")}</span></div>}
          <div className="fc f3"><b className="row g"><Icon n="truck" s={18} /> {trs("تتبّع طلبك لحظة بلحظة")}</b><span className="mu">{trs("من التحضير لحد وصول المندوب")}</span></div>
        </div>
      </section>

      <Banners list={h?.banners} />
      {shop.length > 0 && <CatTiles products={shop} />}
      {shop.length > 0 && <OffersRail products={shop} phs={cat?.pharmacies} />}
      {shop.length > 0 && <BrandsRow products={shop} />}
      {shop.length > 0 && <Rails products={shop} phs={cat?.pharmacies} />}

      <NearSection phs={allPhs} />

      <section className="sec">
        <h2>{trs("إزاي")}{" "}<span className="gr">{trs("دواك")}</span> {trs("بيشتغل؟")}</h2>
        <div className="how">{STEPS.map(([i, t, d], k) => <div className="card" key={k}><div className="hn"><Icon n={i} s={24} /></div><h3>{trs(t)}</h3><p className="mu">{trs(d)}</p></div>)}</div>
      </section>

      <section className="sec">
        <div className="sech"><h2>{trs("منتجات")}{" "}<span className="gr">{trs("متاحة الآن")}</span></h2><a className="go" href="#/shop">{trs("تصفح كل المنتجات ◂")}</a></div>
        {h === null && <div className="pgrid">{[1, 2, 3, 4].map((i) => <div className="pcard sk" key={i}></div>)}</div>}
        {h && !prods.length && <div className="card center"><h3>{trs("لسه مفيش منتجات")}</h3><p className="mu">{trs("أول ما الصيدليات تضيف أدويتها هتظهر هنا.")}</p><a className="btn" href="#/register?role=pharmacy">{trs("سجّل صيدليتك")}</a></div>}
        {prods.length > 0 && <div className="pgrid">{prods.slice(0, 8).map((p) => <ProdCard key={p.name} p={p} />)}</div>}
      </section>

      {phs.length > 0 && <section className="sec">
        <div className="sech"><h2>{trs("صيدليات")}{" "}<span className="gr">{trs("على دواك")}</span></h2></div>
        <div className="phgrid">{phs.slice(0, 6).map((p) => <PharmCard key={p.id} p={p} />)}</div>
      </section>}

      <section className="sec">
        <h2>{trs("أمانك")}{" "}<span className="gr">{trs("أولاً")}</span></h2>
        <div className="how t3">
          <div className="card"><div className="hn"><Icon n="shield" s={24} /></div><h3>{trs("صيدليات بترخيص")}</h3><p className="mu">{trs("مش بنشغّل أي صيدلية غير بعد ما نراجع مستنداتها الرسمية وترخيصها.")}</p></div>
          <div className="card"><div className="hn"><Icon n="lock" s={24} /></div><h3>{trs("خصوصية بياناتك")}</h3><p className="mu">{trs("بياناتك ومعلومات طلباتك مبتتشاركش مع أي طرف تاني.")}</p></div>
          <div className="card"><div className="hn"><Icon n="rx" s={24} /></div><h3>{trs("أدوية الروشتة بمراجعة")}</h3><p className="mu">{trs("الأدوية اللي بتحتاج روشتة بتتطلب بمراجعة صيدلي مرخّص.")}</p></div>
        </div>
      </section>

      <CoverStrip stats={h?.stats} />
      <Reviews />

      <section className="sec">
        <h2>{trs("أسئلة")}{" "}<span className="gr">{trs("شائعة")}</span></h2>
        <div className="faq">{FAQ.map(([a, b]) => <details className="card" key={a}><summary>{trs(a)}</summary><p className="mu">{trs(b)}</p></details>)}</div>
      </section>

      <section className="band">
        <div><h2>{trs("عندك صيدلية؟ انضم لدواك")}</h2><p>{trs("سجّل صيدليتك، وارفع أدويتك وأسعارك، واستقبل طلبات المرضى القريبين منك.")}</p></div>
        <a className="btn g" href="#/register?role=pharmacy">{trs("سجّل صيدليتك مجاناً")}</a>
      </section>
    </div>
  );
}
