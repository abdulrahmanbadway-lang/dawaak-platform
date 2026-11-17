import { km } from './geo.js';
import { ms } from './status.js';

// حدود إشارة المندوب (بالثواني). المندوب بيبعت كل 20 ثانية على الأكتر (حتى وهو واقف)، فأي تأخير أكبر من كده مش طبيعي.
export const SIG = { live: 45, weak: 120 };
// المندوب قريب من العميل لو المسافة أقل من كده (كم)
export const NEAR_KM = 0.15;

// حالة إشارة المندوب: none = لسه ما بدأش | live = مباشر | weak = ضعيفة/متأخرة | lost = انقطعت (غالبًا وقّف المشاركة)
export function signalState(tr, now) {
  if (!tr) return { state: 'none', age: null };
  const t = ms(tr.updatedAt) || now, age = Math.max(0, Math.round((now - t) / 1000));
  return { state: age <= SIG.live ? 'live' : age <= SIG.weak ? 'weak' : 'lost', age };
}
export const isNear = (tr, dest) => !!(tr && dest && km(tr, dest) <= NEAR_KM);

// رابط خرائط جوجل: بالإحداثيات لو متاحة، وإلا بحث بالعنوان النصي
export const mapsUrl = (o) => (o.dest
  ? `https://www.google.com/maps/dir/?api=1&destination=${o.dest.lat},${o.dest.lng}&travelmode=driving`
  : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(o.address || ''));

// الانتقالات المسموحة من واجهة الصيدلية (نفس منطق Rules بالظبط). كل زرار: [الحالة الجديدة, النص, ستايل, رسالة التأكيد|null]
export function pharmacyActions(o) {
  const hasCourier = !!o.courierId;
  if (o.status === 'new') return [['preparing', 'قبول وتجهيز', '', null], ['cancelled', 'رفض الطلب', 'o', 'رفض الطلب؟ المريض هيتبلّغ إنه اتلغى.']];
  if (o.status === 'preparing') return [['out', 'خرج للتوصيل', '', null]];
  if (o.status === 'out') return [['done', hasCourier ? 'تسليم يدوي (بدل المندوب)' : 'تم التسليم', hasCourier ? 'o' : 'g', hasCourier ? 'المندوب هو اللي المفروض يأكد التسليم من صفحته. تأكد إن الطلب وصل فعلًا قبل ما تقفله بنفسك.' : 'تأكيد إن الطلب اتسلّم للعميل؟']];
  return [];
}
