// توحيد الحروف العربية للبحث: أإآ->ا ، ة->ه ، ى->ي وإزالة التشكيل
export const norm = (s = '') => s.toString().trim().toLowerCase()
  .replace(/[\u064B-\u065F]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, ' ');
