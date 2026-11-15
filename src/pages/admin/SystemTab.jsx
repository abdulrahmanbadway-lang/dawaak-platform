import { useState } from 'react';
import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { toast } from '../../ui.jsx';
import { STALE_MS } from './common.jsx';

export default function System({ sessions, now }) {
  const [busy, setBusy] = useState(false);
  const stale = sessions.filter((s) => now - s.t > STALE_MS);
  const clean = async () => {
    if (!stale.length || !confirm(`مسح ${stale.length} سجل قديم (أقدم من 24 ساعة)؟`)) return;
    setBusy(true);
    try {
      for (let i = 0; i < stale.length; i += 400) { const b = writeBatch(db); stale.slice(i, i + 400).forEach((s) => b.delete(doc(db, 'presence', s.id))); await b.commit(); }
      toast('تم المسح ✓');
    } catch (e) { toast('تعذر المسح: ' + (e.code || e.message)); }
    setBusy(false);
  };
  return (
    <>
      <section className="card"><h3>تنضيف سجلات التواجد</h3>
        <p className="mu">كل زائر بيعمل سجل صغير. السجلات الأقدم من 24 ساعة ملهاش لزوم، ومسحها بيقلل القراءات في الحصة المجانية.</p>
        <button className="btn sm" disabled={busy || !stale.length} onClick={clean}>{busy ? '…' : `امسح السجلات القديمة (${stale.length})`}</button></section>
      <section className="card"><h3>حدود الخطة المجانية (Spark)</h3>
        <ul className="adm-ul"><li>الكتابة: 20,000 مستند/يوم. كل تبويب مفتوح بيكتب نبضة كل دقيقة (≈ 60 كتابة/ساعة لكل متصفح).</li>
          <li>القراءة: 50,000 مستند/يوم. فتح لوحة الأدمن وتحديثها بيحسب قراءات.</li>
          <li>لو عدّيت الحصة، Firebase بيرفض العمليات لحد اليوم الجاي (مش بيحاسبك لأن مفيش بطاقة).</li></ul></section>
      <section className="card"><h3>إزاي تعمل حساب أدمن</h3>
        <ol className="adm-ul"><li>سجّل حساب عادي من الموقع (مريض).</li><li>افتح Firebase Console ← Firestore ← مجموعة <b>users</b> ← مستند الحساب ده.</li><li>غيّر الحقل <b>role</b> إلى <b dir="ltr">admin</b> واحفظ، وبعدها سجّل خروج ودخول.</li></ol>
        <p className="mu sm2">مفيش طريقة من الموقع نفسه تخلّي حد أدمن: القواعد بترفض التسجيل أو التعديل بالدور ده.</p></section>
      <section className="card"><h3>الخصوصية</h3>
        <p className="mu">بنسجّل عنوان IP والصفحة الحالية والجهاز لأغراض الأمان والإحصاء، ومعروضين للأدمن بس. نصيحة: اذكر ده في سياسة الخصوصية بتاعة المشروع.</p></section>
    </>
  );
}
