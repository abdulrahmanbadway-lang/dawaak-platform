import { useEffect, useState } from 'react';
import { useAuth, authError } from '../auth.jsx';
import { go } from '../router.js';
import { GOV } from '../lib/gov.js';
import { citiesOf } from '../lib/egypt.js';
import { Field, toast } from '../ui.jsx';
import { DocsFields } from '../docparts.jsx';
import { getPrecise } from '../lib/where.js';
import { Icon } from '../icons.jsx';
import { trs } from '../lib/i18n.js';

export default function AuthPage({ mode, q }) {
  const { profile, issue, login, register, resetPassword } = useAuth();
  const role = q.get('role') === 'pharmacy' ? 'pharmacy' : 'patient'; // التسجيل العادي للمرضى؛ الصيدليات بتنضم من رابط "عندك صيدلية؟"
  const [f, setF] = useState({ name: '', email: '', password: '', pname: '', license: '', phone: '', governorate: '', city: '', address: '' });
  const [docs, setDocs] = useState({}), [ploc, setPloc] = useState(null), [locBusy, setLocBusy] = useState(false);
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const [reset, setReset] = useState(false), [sent, setSent] = useState(false);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
  useEffect(() => { if (profile) go({ pharmacy: '/pharmacy', courier: '/courier', admin: '/admin' }[profile.role] || '/search'); }, [profile]);

  const sendReset = async (e) => {
    e.preventDefault(); setErr('');
    if (!/^\S+@\S+\.\S+$/.test(f.email)) return setErr(trs("اكتب بريد إلكتروني صحيح"));
    setBusy(true);
    try { await resetPassword(f.email.trim()); setSent(true); }
    catch (x) { setErr(authError(x)); }
    setBusy(false);
  };
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    if (!/^\S+@\S+\.\S+$/.test(f.email)) return setErr(trs("اكتب بريد إلكتروني صحيح"));
    if (f.password.length < 6) return setErr(trs("كلمة المرور 6 أحرف على الأقل"));
    if (mode === 'register') {
      if (f.name.trim().length < 2) return setErr(trs("اكتب اسمك"));
      if (role === 'pharmacy' && (!f.pname.trim() || !f.license.trim() || !f.phone.trim() || !f.governorate || !f.city || !f.address.trim()))
        return setErr(trs("كمّل بيانات الصيدلية (الاسم، رقم الترخيص، الموبايل، المحافظة، المدينة، العنوان)"));
      if (role === 'pharmacy' && !ploc) return setErr(trs("حدّد موقع الصيدلية على الخريطة (لازم تكون في الصيدلية وقت التسجيل)"));
      if (role === 'pharmacy' && !(docs.commercial && docs.tax && docs.license)) return setErr(trs("ارفع المستندات الرسمية الثلاثة: السجل التجاري، البطاقة الضريبية، رخصة الصيدلية"));
    }
    setBusy(true);
    try {
      if (mode === 'login') await login(f.email, f.password);
      else await register({ name: f.name.trim(), email: f.email, password: f.password, role,
        pharmacy: role === 'pharmacy' ? { name: f.pname.trim(), license: f.license.trim(), phone: f.phone.trim(), governorate: f.governorate, city: f.city, address: f.address.trim(), hours: '', lat: ploc ? ploc.lat : null, lng: ploc ? ploc.lng : null } : null, docs: role === 'pharmacy' ? docs : null });
      toast(trs("أهلاً بيك في دواك 👋"));
    } catch (x) { setErr(authError(x)); }
    setBusy(false);
  };
  if (mode === 'login' && reset) return (
    <form className="card narrow" onSubmit={sendReset}>
      <h2>{trs("استرجاع كلمة المرور")}</h2>
      {sent ? <>
        <p className="mu">{trs("لو البريد ده مسجّل عندنا، هيوصلك رابط لتعيين كلمة مرور جديدة. افتح الرسالة واضغط على الرابط. لو مش لاقيها شوف مجلد الرسائل غير المرغوبة (Spam).")}</p>
        <button type="button" className="btn full" onClick={() => { setReset(false); setSent(false); }}>{trs("رجوع لتسجيل الدخول")}</button>
      </> : <>
        <p className="mu">{trs("اكتب بريدك الإلكتروني اللي سجّلت بيه وهنبعتلك رابط لتعيين كلمة مرور جديدة.")}</p>
        <Field label={trs("البريد الإلكتروني")} name="email" type="email" v={f.email} on={set('email')} autoComplete="email" dir="ltr" />
        {err && <p className="err">{err}</p>}
        <button className="btn full" disabled={busy}>{busy ? '…' : trs("إرسال رابط التعيين")}</button>
        <p className="mu c"><a href="#/login" onClick={(e) => { e.preventDefault(); setReset(false); setErr(''); }}>{trs("رجوع لتسجيل الدخول")}</a></p>
      </>}
    </form>
  );
  return (
    <form className="card narrow" onSubmit={submit}>
      <h2>{mode === 'login' ? trs("تسجيل الدخول") : role === 'pharmacy' ? trs("انضمام صيدلية لدواك") : trs("إنشاء حساب جديد")}</h2>
      {mode === 'register' && role === 'pharmacy' && <p className="mu sm2">{trs("ابعتلنا بيانات صيدليتك، وهنراجع الترخيص ونوثّقها قبل ما تظهر كصيدلية موثّقة.")}</p>}
      {mode === 'register' && <Field label={role === 'pharmacy' ? trs("اسم المسؤول") : trs("الاسم")} name="name" v={f.name} on={set('name')} autoComplete="name" />}
      <Field label={trs("البريد الإلكتروني")} name="email" type="email" v={f.email} on={set('email')} autoComplete="email" dir="ltr" />
      <Field label={trs("كلمة المرور")} name="password" type="password" v={f.password} on={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} dir="ltr" />
      {mode === 'register' && role === 'pharmacy' && <>
        <h3>{trs("بيانات الصيدلية")}</h3>
        <Field label={trs("اسم الصيدلية")} name="pname" v={f.pname} on={set('pname')} />
        <Field label={trs("رقم ترخيص الصيدلية")} name="license" v={f.license} on={set('license')} hint={trs("هيتم التحقق منه قبل توثيق الصيدلية")} />
        <Field label={trs("رقم الموبايل")} name="phone" type="tel" v={f.phone} on={set('phone')} dir="ltr" />
        <Field label={trs("المحافظة")} name="governorate" type="select" options={GOV} v={f.governorate} on={(v) => setF((s) => ({ ...s, governorate: v, city: '' }))} />
        <Field label={trs("المدينة / المنطقة")} name="city" type="select" options={citiesOf(f.governorate)} v={f.city} on={set('city')} />
        <Field label={trs("العنوان بالتفصيل")} name="address" v={f.address} on={set('address')} />
        <div className={'dp' + (ploc ? ' ok' : '')}>
          <Icon n="pin" s={20} />
          <div className="dpt">{ploc ? <><b>{trs("تم تحديد موقع الصيدلية ✓")}</b> · {trs("الدقة")} ±{ploc.acc} {trs("م")}</> : <><b>{trs("موقع الصيدلية على الخريطة")}</b><p className="mu sm2">{trs("اضغط وإنت في الصيدلية، عشان تظهر للمرضى اللي جنبك وعشان المناديب.")}</p></>}</div>
          <button type="button" className="btn o sm" disabled={locBusy} onClick={async () => { setLocBusy(true); try { setPloc(await getPrecise()); toast(trs("تم تحديد موقع الصيدلية ✓")); } catch { toast(trs("اسمح بالوصول للموقع من إعدادات المتصفح")); } setLocBusy(false); }}>{locBusy ? '…' : ploc ? trs("حدّث") : trs("حدّد موقعي")}</button>
        </div>
        <h3>{trs("بيانات الصيدلية الرسمية")}</h3>
        <p className="mu sm2">{trs("المستندات دي بتوصل للإدارة بس (مش بتظهر لأي مستخدم)، وبنراجعها ونتأكد من صحتها قبل توثيق الصيدلية.")}</p>
        <DocsFields docs={docs} setDocs={setDocs} />
      </>}
      {err && <p className="err">{err}</p>}
      {!err && issue && <p className="err" dir="auto">{issue}</p>}
      <button className="btn full" disabled={busy}>{busy ? '…' : mode === 'login' ? trs("دخول") : trs("إنشاء الحساب")}</button>
      {mode === 'login' && <p className="c"><a href="#/login" style={{ color: 'var(--bl2)', fontWeight: 700 }} onClick={(e) => { e.preventDefault(); setReset(true); setErr(''); }}>{trs("نسيت كلمة السر؟")}</a></p>}
      <p className="mu c">{mode === 'login' ? <>{trs("معندكش حساب؟")}{" "}<a href="#/register">{trs("سجّل دلوقتي")}</a></> : <>{trs("عندك حساب؟")}{" "}<a href="#/login">{trs("سجّل دخول")}</a></>}</p>
      {mode === 'register' && <p className="mu c">{role === 'pharmacy' ? <a href="#/register">{trs("رجوع لإنشاء حساب عادي")}</a> : <a href="#/register?role=pharmacy">{trs("عندك صيدلية؟ انضم لدواك")}</a>}</p>}
    </form>
  );
}
