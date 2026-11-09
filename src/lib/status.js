export const STEPS = [['new', 'تم الاستلام'], ['preparing', 'قيد التحضير'], ['out', 'في الطريق'], ['done', 'تم التسليم']];
export const LABEL = { new: 'جديد', preparing: 'قيد التحضير', out: 'في الطريق', done: 'تم التسليم', cancelled: 'ملغي' };
export const ms = (t) => (t && t.toMillis ? t.toMillis() : t || 0);
export const RX_LABEL = { pending: 'بانتظار رد الصيدلي', need_info: 'الصيدلي محتاج توضيح', quoted: 'تم الرد · بانتظار تأكيدك', unavailable: 'غير متاحة', ordered: 'اتحوّلت لطلب', cancelled: 'ملغية' };
export const RX_TONE = { pending: 'am', need_info: 'am', quoted: 'ok', unavailable: 'rd', ordered: 'ok', cancelled: 'rd' };
export const RX_OPEN = ['pending', 'need_info', 'quoted'];
