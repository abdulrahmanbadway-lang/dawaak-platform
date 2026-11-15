// تراجع عن رفع كتالوج الـ 1000 منتج: بيمسح مستندات الكتالوج (cat-*) وبيرجّع منتجات العرض الأصلية (seed-*). مش بيلمس الحسابات ولا الطلبات ولا باقي البيانات.
import { ACCOUNTS, buildDocs, commit, findUser, getToken, projectId } from './lib.mjs';
import { catalogDocs } from './catalog-lib.mjs';

try {
  const pid = projectId();
  console.log('▶ المشروع:', pid);
  const tok = await getToken(), uids = {};
  for (const a of ACCOUNTS) uids[a.key] = await findUser(tok, pid, a.email);
  const miss = ACCOUNTS.filter((a) => a.role === 'pharmacy' && !uids[a.key]).map((a) => a.key);
  if (miss.length) throw new Error('حسابات الصيدليات التجريبية مش موجودة (' + miss.join(',') + '): مفيش حاجة اتعدّلت.');
  const del = catalogDocs((k) => uids[k]).map((d) => ({ path: d.path, del: true }));
  const back = buildDocs((k) => uids[k]).filter((d) => d.path.startsWith('products/seed-'));
  console.log(`  هيتمسح ${del.length} منتج من الكتالوج الجديد، ويرجع ${back.length} منتج من منتجات العرض الأصلية.`);
  await commit(tok, pid, [...del, ...back]);
  console.log('✓ تم الرجوع. حدّث الموقع (أقفل الصفحة وافتحها تاني).');
} catch (e) { console.error('✗ ' + e.message); process.exit(1); }
