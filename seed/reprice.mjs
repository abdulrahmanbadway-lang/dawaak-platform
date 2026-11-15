// تحديث أسعار منتجات العرض بس (price / oldPrice) من غير ما يلمس الصور أو أي حاجة تانية.
// مفيد بعد ما ترفع صور حقيقية من لوحة التحكم: seed.mjs كان هيرجّع الصور التجريبية، أما ده لأ.
// الاستخدام:  node seed/reprice.mjs
import { buildDocs, commit, getToken, projectId } from './lib.mjs';

try {
  const pid = projectId();
  console.log('▶ المشروع:', pid);
  const tok = await getToken();
  const writes = buildDocs((k) => k).filter((d) => d.path.startsWith('products/seed-'))
    .map((d) => ({ path: d.path, data: { price: d.data.price, ...(d.data.oldPrice ? { oldPrice: d.data.oldPrice } : {}) }, mask: ['price', 'oldPrice'] }));
  await commit(tok, pid, writes);
  console.log(`✓ اتحدّثت أسعار ${writes.length} منتج (الصور والباقي زي ما هو).`);
} catch (e) { console.error('✗ ' + e.message); process.exit(1); }
