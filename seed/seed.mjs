// تعبئة قاعدة بيانات دواك ببيانات عرض كاملة: دكاترة (صيدليات) + مناديب + مرضى + منتجات بصور + طلبات + روشتات + بانرات.
// ماينفعش تتشغل غير على مشروعك إنت. الأدمن مش بيتلمس. للمسح: node seed/clear.mjs
import { ACCOUNTS, PASSWORD, buildDocs, commit, ensureUser, getToken, projectId } from './lib.mjs';

try {
  const pid = projectId();
  console.log('▶ المشروع:', pid);
  const tok = await getToken();
  const uids = {};
  for (const a of ACCOUNTS) { uids[a.key] = await ensureUser(tok, pid, a); process.stdout.write('.'); }
  console.log('\n✓ الحسابات جاهزة (' + ACCOUNTS.length + ')');
  const docs = buildDocs((k) => uids[k]);
  await commit(tok, pid, docs);
  const n = (p) => docs.filter((d) => d.path.startsWith(p) && !d.path.includes('/messages/')).length;
  console.log(`✓ اتكتب: ${n('pharmacies/')} صيدليات · ${n('products/')} منتج · ${n('couriers/')} مناديب · ${n('orders/')} طلب · ${n('prescriptions/')} روشتات · ${n('banners/')} بانرات`);
  console.log('\n══ حسابات العرض (كلمة السر لكلهم: ' + PASSWORD + ') ══');
  const L = { pharmacy: 'دكتور/صيدلية', courier: 'مندوب', patient: 'مريض' };
  ACCOUNTS.forEach((a) => console.log(`${L[a.role].padEnd(13)} ${a.email.padEnd(20)} ${a.name}`));
  console.log('\nسجّل دخول من الموقع بأي حساب منهم. ولعرض تحرك المندوب لحظياً: node seed/simulate.mjs');
  console.log('بعد العرض امسح كل ده: node seed/clear.mjs  (الحسابات دي كلمة سرها معروفة، فماتسيبهاش على موقع شغّال)');
} catch (e) { console.error('✗ ' + e.message); process.exit(1); }
