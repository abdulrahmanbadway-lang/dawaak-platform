import { useEffect, useState } from 'react';
import { useAuth, authError } from '../auth.jsx';
import { go } from '../router.js';
import { GOV } from '../lib/gov.js';
import { Field, toast } from '../ui.jsx';

export default function AuthPage({ mode, q }) {
  const { profile, issue, login, register } = useAuth();
  const [role, setRole] = useState(q.get('role') === 'pharmacy' ? 'pharmacy' : 'patient');
  const [f, setF] = useState({ name: '', email: '', password: '', pname: '', license: '', phone: '', governorate: '', address: '' });
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v }));
  useEffect(() => { if (profile) go({ pharmacy: '/pharmacy', courier: '/courier', admin: '/admin' }[profile.role] || '/search'); }, [profile]);

  const submit = async (e) => {
    e.preventDefault(); setErr('');
    if (!/^\S+@\S+\.\S+$/.test(f.email)) return setErr('اكتب بريد إلكتروني صحيح');
    if (f.password.length < 6) return setErr('كلمة المرور 6 أحرف على الأقل');
    if (mode === 'register') {
      if (f.name.trim().length < 2) return setErr('اكتب اسمك');
      if (role === 'pharmacy' && (!f.pname.trim() || !f.license.trim() || !f.phone.trim() || !f.governorate || !f.address.trim()))
        return setErr('كمّل بيانات الصيدلية (الاسم، رقم الترخيص، الموبايل، المحافظة، العنوان)');
    }
    setBusy(true);
    try {
      if (mode === 'login') await login(f.email, f.password);
      else await register({ name: f.name.trim(), email: f.email, password: f.password, role,
        pharmacy: role === 'pharmacy' ? { name: f.pname.trim(), license: f.license.trim(), phone: f.phone.trim(), governorate: f.governorate, address: f.address.trim(), hours: '' } : null });
      toast('أهلاً بيك في دواك 👋');
    } catch (x) { setErr(authError(x)); }
    setBusy(false);
  };
  return (
    <form className="card narrow" onSubmit={submit}>
      <h2>{mode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}</h2>
      {mode === 'register' && <div className="seg">
        <button type="button" className={role === 'patient' ? 'on' : ''} onClick={() => setRole('patient')}>أنا مريض</button>
        <button type="button" className={role === 'pharmacy' ? 'on' : ''} onClick={() => setRole('pharmacy')}>أنا صيدلية</button>
      </div>}
      {mode === 'register' && <Field label={role === 'pharmacy' ? 'اسم المسؤول' : 'الاسم'} name="name" v={f.name} on={set('name')} autoComplete="name" />}
      <Field label="البريد الإلكتروني" name="email" type="email" v={f.email} on={set('email')} autoComplete="email" dir="ltr" />
      <Field label="كلمة المرور" name="password" type="password" v={f.password} on={set('password')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} dir="ltr" />
      {mode === 'register' && role === 'pharmacy' && <>
        <h3>بيانات الصيدلية</h3>
        <Field label="اسم الصيدلية" name="pname" v={f.pname} on={set('pname')} />
        <Field label="رقم ترخيص الصيدلية" name="license" v={f.license} on={set('license')} hint="هيتم التحقق منه قبل توثيق الصيدلية" />
        <Field label="رقم الموبايل" name="phone" type="tel" v={f.phone} on={set('phone')} dir="ltr" />
        <Field label="المحافظة" name="governorate" type="select" options={GOV} v={f.governorate} on={set('governorate')} />
        <Field label="العنوان بالتفصيل" name="address" v={f.address} on={set('address')} />
      </>}
      {err && <p className="err">{err}</p>}
      {!err && issue && <p className="err" dir="auto">{issue}</p>}
      <button className="btn full" disabled={busy}>{busy ? '…' : mode === 'login' ? 'دخول' : 'إنشاء الحساب'}</button>
      <p className="mu c">{mode === 'login' ? <>معندكش حساب؟ <a href="#/register">سجّل دلوقتي</a></> : <>عندك حساب؟ <a href="#/login">سجّل دخول</a></>}</p>
    </form>
  );
}
