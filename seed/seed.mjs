// تعبئة قاعدة بيانات دواك ببيانات تجريبية جاهزة (صيدليات + أدوية + حساب مريض + طلبات)
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
  const n = (p) => docs.filter((d) => d.path.startsWith(p)).length;
  console.log(`✓ اتكتب: ${n('pharmacies/')} صيدليات · ${n('products/')} منتج · ${n('orders/')} طلبات`);
  console.log('\n══ حسابات التجربة (كلمة السر لكلهم: ' + PASSWORD + ') ══');
  ACCOUNTS.forEach((a) => console.log(`${a.role === 'pharmacy' ? 'صيدلية ' : 'مريض   '} ${a.email}  —  ${a.name}`));
  console.log('\nافتح الموقع وسجّل دخول بأي حساب منهم. لمسح البيانات: node seed/clear.mjs');
} catch (e) { console.error('✗ ' + e.message); process.exit(1); }
