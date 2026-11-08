// مسح البيانات التجريبية اللي اتعملت بواسطة seed.mjs (الحسابات والصيدليات والمنتجات والطلبات)
import { ACCOUNTS, buildDocs, commit, deleteUser, findUser, getToken, projectId } from './lib.mjs';

try {
  const pid = projectId(), tok = await getToken(), uids = {};
  for (const a of ACCOUNTS) uids[a.key] = await findUser(tok, pid, a.email);
  const docs = buildDocs((k) => uids[k] || 'none-' + k);
  await commit(tok, pid, docs.map((d) => ({ path: d.path, del: true })));
  for (const a of ACCOUNTS) if (uids[a.key]) await deleteUser(tok, pid, uids[a.key]);
  console.log('✓ تم مسح البيانات التجريبية (' + docs.length + ' مستند + ' + ACCOUNTS.length + ' حساب)');
} catch (e) { console.error('✗ ' + e.message); process.exit(1); }
