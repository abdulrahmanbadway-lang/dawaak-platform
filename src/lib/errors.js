import { trs } from './i18n.js';

// رسالة خطأ مفهومة للمستخدم من أي استثناء (Firestore / شبكة / أخطاء بنرميها إحنا). الكود التقني بيتحط بين قوسين للتشخيص.
export function errKind(e) {
  const c = String(e?.code || '').replace(/^firestore\//, '').replace(/^auth\//, '');
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'net';
  if (c === 'permission-denied') return 'perm';
  if (c === 'unauthenticated' || c === 'requires-recent-login') return 'auth';
  if (c === 'unavailable' || c === 'deadline-exceeded' || c === 'network-request-failed' || /network|offline|failed to fetch/i.test(e?.message || '')) return 'net';
  if (c === 'resource-exhausted') return 'quota';
  if (c === 'not-found') return 'nf';
  if (c === 'failed-precondition' || c === 'aborted') return 'state';
  return c ? 'other' : 'plain';
}
export function errMsg(e) {
  const k = errKind(e), code = e?.code ? ' (' + e.code + ')' : '';
  switch (k) {
    case 'net': return trs("مفيش اتصال بالإنترنت أو الخدمة مش متاحة دلوقتي. اتأكد من الشبكة وجرّب تاني.");
    case 'perm': return trs("مفيش صلاحية لتنفيذ ده. لو المفروض تقدر، سجّل خروج وادخل تاني.") + code;
    case 'auth': return trs("لازم تسجّل دخول الأول.") + code;
    case 'quota': return trs("الخدمة مشغولة دلوقتي (حد الاستخدام المجاني اتعدّى). جرّب بعد شوية.") + code;
    case 'nf': return trs("المطلوب مش موجود.") + code;
    case 'state': return trs("العملية دي مش ممكنة في الحالة الحالية. حدّث الصفحة وجرّب تاني.") + code;
    case 'plain': return e?.message || trs("حصل خطأ غير متوقع.");
    default: return (e?.message || trs("حصل خطأ غير متوقع.")) + code;
  }
}
