import { useState } from 'react';
import { toast } from '../../ui.jsx';
import { waLink } from '../../lib/site.js';
import { requestRecoveryLink } from '../../lib/recovery.js';
import { Modal } from './common.jsx';

// استرجاع حساب: بيولّد رابط تعيين كلمة سر (صالح لمدة ساعة) والأدمن يبعته للمستخدم على واتساب بعد ما يتأكد من هويته
export default function RecoveryModal({ u, onClose }) {
  const [busy, setBusy] = useState(false), [res, setRes] = useState(null), [err, setErr] = useState('');
  const go = async () => {
    setBusy(true); setErr('');
    try { setRes(await requestRecoveryLink(u.id)); } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const msg = res ? `مرحباً ${res.name || ''}، ده رابط تعيين كلمة سر جديدة لحسابك على دواك (صالح لمدة ساعة واحدة):\n${res.link}\nبعد ما تعيّن كلمة السر تقدر تدخل بالبريد أو برقم موبايلك. لو مطلبتش ده تجاهل الرسالة.` : '';
  const copy = async () => { try { await navigator.clipboard.writeText(res.link); toast('اتنسخ الرابط ✓'); } catch { toast('تعذّر النسخ'); } };
  return (
    <Modal title={`استرجاع حساب ${u.name}`} onClose={onClose}>
      {!res ? <>
        <p className="mu">هيتولّد رابط تعيين كلمة سر جديدة لحساب <b>{u.name}</b> <bdi dir="ltr">({u.email}{u.phone ? ' · ' + u.phone : ''})</bdi>. الرابط صالح <b>ساعة واحدة</b> ولمرة واحدة.</p>
        <p className="adm-alerts"><span>تأكد من هويته الأول (مثلًا يقولك آخر طلب أو عنوانه). اللي معاه الرابط يقدر يغيّر كلمة سر الحساب.</span></p>
        {err && <p className="err" role="alert">{err}</p>}
        <div className="row g"><button className="btn" disabled={busy} onClick={go}>{busy ? '…' : 'توليد الرابط'}</button><button className="btn o" onClick={onClose}>إلغاء</button></div>
      </> : <>
        <p className="mu">اتولّد الرابط. ابعته للمستخدم دلوقتي (بيخلص بعد ساعة).</p>
        <textarea className="fi" readOnly rows={4} dir="ltr" value={res.link} onFocus={(e) => e.target.select()} aria-label="رابط التعيين" />
        <div className="row g wrap">
          {res.phone ? <a className="btn g" target="_blank" rel="noopener noreferrer" href={waLink(res.phone, msg)}>ابعته على واتساب ({res.phone})</a> : <span className="mu sm2">الحساب ده مالوش رقم، انسخ الرابط وابعته بطريقة تانية.</span>}
          <button className="btn o" onClick={copy}>انسخ الرابط</button><button className="btn o" onClick={onClose}>خلصت</button>
        </div>
      </>}
    </Modal>);
}
