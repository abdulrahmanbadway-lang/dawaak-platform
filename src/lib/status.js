export const STEPS = [['new', 'تم الاستلام'], ['preparing', 'قيد التحضير'], ['out', 'في الطريق'], ['done', 'تم التسليم']];
export const LABEL = { new: 'جديد', preparing: 'قيد التحضير', out: 'في الطريق', done: 'تم التسليم', cancelled: 'ملغي' };
export const ms = (t) => (t && t.toMillis ? t.toMillis() : t || 0);
