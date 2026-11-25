import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './auth.jsx';
import { Icon } from './icons.jsx';
import { Badge, toast } from './ui.jsx';
import { trs, lcl } from './lib/i18n.js';
import { loadContact, waLink } from './lib/site.js';
import { AUD, GROUPS, day0, daysLeft, newRefill, readRefills, refillState, summaryText, writeRefills } from './lib/care.js';
import './care.css';

// ── المساعد الصيدلي: تقييم مبدئي بخطوات (اختيار الحالة ← 3 أسئلة ← نصايح وعلامات خطر) ──
function Assistant() {
  const [g, setG] = useState(null), [step, setStep] = useState(0);
  const [a, setA] = useState({ symptoms: '', audience: '', history: '' }), [red, setRed] = useState([]), [wa, setWa] = useState('');
  const top = useRef(null);
  useEffect(() => { loadContact().then((c) => setWa(c.whatsapp || '')); }, []);
  useEffect(() => { top.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [step, g]);
  const reset = () => { setG(null); setStep(0); setA({ symptoms: '', audience: '', history: '' }); setRed([]); };
  const set = (k, v) => setA((x) => ({ ...x, [k]: v }));
  const text = g ? summaryText(g, a) : '';
  const copy = async () => { try { await navigator.clipboard.writeText(text); toast(trs("تم نسخ الملخص ✓")); } catch { toast(trs("تعذّر النسخ")); } };

  if (!g) return (
    <div ref={top}>
      <p className="mu">{trs("اختار نوع الشكوى وجاوب على 3 أسئلة بسيطة، وهنديك نصايح عامة وعلامات الخطر اللي تستدعي دكتور.")}</p>
      <div className="cg">{GROUPS.map((x) => <button key={x.id} onClick={() => setG(x)}><Icon n={x.ic} s={26} /><b>{trs(x.label)}</b></button>)}</div>
    </div>);

  const done = step >= 3;
  const ok0 = a.symptoms.trim().length >= 3;
  return (
    <div ref={top}>
      <div className="row g between wrap"><h3>{trs(g.label)}</h3><button className="btn o sm" onClick={reset}>{trs("استشارة جديدة")}</button></div>
      {!done && <div className="stp" aria-label={trs("خطوة") + ' ' + (step + 1) + '/3'}>{[0, 1, 2].map((i) => <i key={i} className={i <= step ? 'on' : ''} />)}</div>}
      {step === 0 && <div className="card"><label className="fl" htmlFor="cs">{trs("إيه الأعراض بالتحديد ومن امتى بدأت؟")}</label>
        <textarea id="cs" className="fi" rows={3} maxLength={400} value={a.symptoms} onChange={(e) => set('symptoms', e.target.value)} placeholder={trs("مثال: صداع مستمر من يومين مع دوخة خفيفة")} />
        <button className="btn full" disabled={!ok0} onClick={() => setStep(1)}>{trs("التالي")}</button></div>}
      {step === 1 && <div className="card"><b className="fl">{trs("الاستشارة لمين؟")}</b>
        <div className="opts">{Object.entries(AUD).map(([k, v]) => <button key={k} className={a.audience === k ? 'on' : ''} onClick={() => set('audience', k)}>{trs(v)}</button>)}</div>
        <button className="btn full" disabled={!a.audience} onClick={() => setStep(2)}>{trs("التالي")}</button></div>}
      {step === 2 && <div className="card"><label className="fl" htmlFor="ch">{trs("عنده أمراض مزمنة أو حساسية من أدوية؟")}</label>
        <input id="ch" className="fi" maxLength={200} value={a.history} onChange={(e) => set('history', e.target.value)} placeholder={trs("اكتب «لا يوجد» لو مفيش")} />
        <button className="btn full" onClick={() => setStep(3)}>{trs("اعرض النصايح")}</button></div>}
      {done && <>
        <div className="card"><b>{trs("هل عندك أي من العلامات دي؟")}</b>
          <div className="chk">{g.red.map((r) => <label key={r}><input type="checkbox" checked={red.includes(r)} onChange={(e) => setRed((l) => (e.target.checked ? [...l, r] : l.filter((x) => x !== r)))} />{trs(r)}</label>)}</div>
          {red.length > 0 && <div className="alertb" role="alert"><Icon n="phone" s={20} /><span>{trs("العلامات دي محتاجة دكتور فورًا. لو الحالة طارئة اتصل بالإسعاف 123 أو روح أقرب مستشفى.")}</span><a className="btn sm" href="tel:123">{trs("اتصل 123")}</a></div>}
        </div>
        <div className="card"><b>{trs("نصايح عامة تناسب حالتك")}</b><ul className="tips">{g.tips.map((t) => <li key={t}>{trs(t)}</li>)}</ul>
          <p className="mu sm2">{trs("المعلومات دي عامة وتوعوية ومش تشخيص ولا بديل عن الصيدلي أو الدكتور.")}</p></div>
        <div className="card"><b>{trs("ملخص استشارتك")}</b><pre className="sum">{text}</pre>
          <div className="row g wrap"><a className="btn g" href="#/rx/new">{trs("اسأل صيدلي")}</a>
            {wa && <a className="btn o" target="_blank" rel="noopener noreferrer" href={waLink(wa, text)}>{trs("ابعته على واتساب")}</a>}
            <button className="btn o" onClick={copy}>{trs("انسخ الملخص")}</button></div></div>
      </>}
    </div>);
}

// ── تذكير الدوا الشهري: قائمة أدوية مزمنة بتنبّهك قبل ما تخلص ──
function Refill() {
  const { user } = useAuth(), uid = user?.uid || null;
  const [list, setList] = useState(() => readRefills(uid)), [name, setName] = useState(''), [days, setDays] = useState('30');
  useEffect(() => { setList(readRefills(uid)); }, [uid]);
  const save = (l) => { setList(l); if (!writeRefills(uid, l)) toast(trs("تعذّر الحفظ على الجهاز")); };
  const add = (e) => {
    e.preventDefault();
    if (name.trim().length < 2) return;
    save([...list, newRefill(name, days)]); setName(''); toast(trs("اتضاف التذكير ✓"));
  };
  const rows = useMemo(() => list.map((r) => ({ r, d: daysLeft(r), s: refillState(r) })).sort((x, y) => x.d - y.d), [list]);
  const due = rows.filter((x) => x.s !== 'ok').length;
  const label = ({ r, d }) => (d < 0 ? trs("متأخر {0} يوم", [-d]) : d === 0 ? trs("بيخلص النهاردة") : trs("باقي {0} يوم", [d]));
  const when = (r) => new Date(r.start + (r.days) * 86400000).toLocaleDateString(lcl());
  return (
    <div>
      <p className="mu">{trs("ضيف أدويتك المزمنة (ضغط، سكر…) وهنفكّرك قبل ما تخلص بوقت كافي. البيانات محفوظة على جهازك بس.")}</p>
      {due > 0 && <div className="alertb warn" role="status"><Icon n="clock" s={20} /><span>{trs("عندك {0} دوا محتاج تجديد قريب.", [due])}</span></div>}
      <form className="card rfm" onSubmit={add}>
        <div><label className="fl" htmlFor="rn">{trs("اسم الدوا")}</label><input id="rn" className="fi" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder={trs("مثال: ميتفورمين 500")} /></div>
        <div><label className="fl" htmlFor="rd">{trs("العلبة بتكفي كام يوم؟")}</label><input id="rd" className="fi" type="number" min="1" max="365" value={days} onChange={(e) => setDays(e.target.value)} /></div>
        <button className="btn" disabled={name.trim().length < 2}><Icon n="plus" s={16} /> {trs("ضيف")}</button>
      </form>
      {!rows.length ? <div className="card center"><p className="mu">{trs("لسه مفيش أدوية متسجلة.")}</p></div> : rows.map((x) => (
        <div key={x.r.id} className={'card rfr ' + x.s}>
          <div><b>{x.r.name}</b><div className="mu sm2">{trs("يخلص تقريبًا")}: {when(x.r)}</div></div>
          <Badge c={x.s === 'late' ? 'rd' : x.s === 'soon' ? 'am' : ''}>{label(x)}</Badge>
          <div className="row g wrap">
            <a className="btn sm" href={'#/search?q=' + encodeURIComponent(x.r.name)}>{trs("ابحث عنه")}</a>
            <button className="btn o sm" onClick={() => { save(list.map((y) => (y.id === x.r.id ? { ...y, start: day0(Date.now()) } : y))); toast(trs("اتجدد من النهاردة ✓")); }}>{trs("جدّدته")}</button>
            <button className="btn o sm" aria-label={trs("حذف") + ' ' + x.r.name} onClick={() => save(list.filter((y) => y.id !== x.r.id))}>{trs("حذف")}</button>
          </div>
        </div>))}
    </div>);
}

export default function Care({ q }) {
  const [tab, setTab] = useState(q?.get('t') === 'refill' ? 'refill' : 'ai');
  return (
    <div className="care">
      <h1>{trs("رعايتك")}</h1>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'ai'} className={tab === 'ai' ? 'on' : ''} onClick={() => setTab('ai')}>{trs("المساعد الصيدلي")}</button>
        <button role="tab" aria-selected={tab === 'refill'} className={tab === 'refill' ? 'on' : ''} onClick={() => setTab('refill')}>{trs("تذكير الدوا الشهري")}</button>
      </div>
      {tab === 'ai' ? <Assistant /> : <Refill />}
    </div>);
}
