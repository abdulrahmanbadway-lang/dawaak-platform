// رفع كتالوج الـ 1000 منتج على المشروع (بيستبدل منتجات العرض القديمة الـ 63 لو مفيش --keep-old).
// تحذير: ده بيكتب مستندات كاملة، فلو رفعت صور حقيقية على المنتجات دي قبل كده هتتمسح لو أعدت تشغيله. شغّله مرة واحدة قبل رفع الصور.
// الاستخدام:  node seed/catalog.mjs [--keep-old] [--dry]
import { PHARMACIES, buildDocs, commit, findUser, getToken, projectId, ACCOUNTS } from './lib.mjs';
import { catalogDocs, catalogStats, hasCatalog } from './catalog-lib.mjs';

try {
  if (!hasCatalog()) throw new Error('الملف seed/data/products-1000.json مش موجود.');
  const keep = process.argv.includes('--keep-old'), dry = process.argv.includes('--dry');
  const pid = projectId();
  console.log('▶ المشروع:', pid);
  const tok = await getToken(), uids = {};
  for (const a of ACCOUNTS) uids[a.key] = await findUser(tok, pid, a.email);
  const miss = PHARMACIES.map((_, i) => 'ph' + (i + 1)).filter((k) => !uids[k]);
  if (miss.length) throw new Error('حسابات الصيدليات التجريبية مش موجودة (' + miss.join(',') + '). شغّل seed.mjs الأول.');
  const docs = catalogDocs((k) => uids[k]);
  const old = keep ? [] : buildDocs((k) => uids[k] || 'none-' + k).filter((d) => d.path.startsWith('products/seed-')).map((d) => ({ path: d.path, del: true }));
  console.log(`  ${docs.length} مستند منتج جديد، ويتمسح ${old.length} منتج قديم من منتجات العرض.`);
  if (dry) { console.table(catalogStats(docs)); process.exit(0); }
  await commit(tok, pid, [...old, ...docs]);
  console.log('✓ تم. افتح الموقع > المتجر. الصور: لوحة التحكم > صور المنتجات.');
} catch (e) { console.error('✗ ' + e.message); process.exit(1); }
