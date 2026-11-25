// اختبار المنطق بأدوات وهمية: node test.js
const { recover, _hits } = require('./lib.js');
const assert = require('assert');
const now = 1_800_000_000_000, ok = [];
const mk = (users = {}, authUsers = {}, tokens = {}) => ({
  auth: {
    verifyIdToken: async (t) => { if (!tokens[t]) throw new Error('bad'); return tokens[t]; },
    getUser: async (u) => { if (!authUsers[u]) throw new Error('nf'); return authUsers[u]; },
    generatePasswordResetLink: async (email, o) => `https://x/__/auth/action?mode=resetPassword&e=${email}&c=${o.url}`,
  },
  db: { audit: [], doc: (p) => ({ get: async () => { const d = users[p.split('/')[1]]; return { exists: !!d, data: () => d }; } }),
    collection() { return { add: async (d) => { this.audit.push(d); } }; } },
});
const U = { adm: { role: 'admin', name: 'مدير' }, bad: { role: 'admin', blocked: true }, p1: { role: 'patient', name: 'أحمد', phone: '01012345678' }, adm2: { role: 'admin' }, noem: { role: 'patient', name: 'ن' } };
const A = { patient0001: { email: 'a@b.com' }, noemail001: {} };
U.patient0001 = U.p1; U.noemail001 = U.noem; U.admin00002 = U.adm2;
const T = { good: { uid: 'adm', auth_time: now / 1000 - 60 }, old: { uid: 'adm', auth_time: now / 1000 - 7200 }, blk: { uid: 'bad', auth_time: now / 1000 }, pat: { uid: 'patient0001', auth_time: now / 1000 } };
const base = (o) => ({ origin: 'https://site', allowed: ['https://site'], site: 'https://site', now, ...o });
const t = async (name, fn) => { try { await fn(); ok.push('ok   ' + name); } catch (e) { ok.push('FAIL ' + name + ' → ' + e.message); process.exitCode = 1; } };
const rej = async (p, code) => { try { await p; } catch (e) { assert.strictEqual(e.code, code); return; } throw new Error('expected ' + code); };
(async () => {
  await t('admin gets link + phone', async () => { const m = mk(U, A, T); const r = await recover(base({ ...m, token: 'good', uid: 'patient0001' })); assert(r.link.includes('a@b.com')); assert.strictEqual(r.phone, '01012345678'); assert.strictEqual(m.db.audit.length, 1); assert.strictEqual(m.db.audit[0].by, 'adm'); });
  _hits.clear();
  await t('wrong origin', async () => rej(recover(base({ ...mk(U, A, T), origin: 'https://evil', token: 'good', uid: 'patient0001' })), 'bad-origin'));
  await t('no token', async () => rej(recover(base({ ...mk(U, A, T), token: '', uid: 'patient0001' })), 'no-token'));
  await t('bad token', async () => rej(recover(base({ ...mk(U, A, T), token: 'nope', uid: 'patient0001' })), 'bad-token'));
  await t('stale login (>1h)', async () => rej(recover(base({ ...mk(U, A, T), token: 'old', uid: 'patient0001' })), 'recent-login'));
  await t('patient token refused', async () => rej(recover(base({ ...mk(U, A, T), token: 'pat', uid: 'patient0001' })), 'not-admin'));
  await t('blocked admin refused', async () => rej(recover(base({ ...mk(U, A, T), token: 'blk', uid: 'patient0001' })), 'not-admin'));
  await t('cannot target an admin', async () => rej(recover(base({ ...mk(U, A, T), token: 'good', uid: 'admin00002' })), 'target-admin'));
  await t('bad uid format', async () => rej(recover(base({ ...mk(U, A, T), token: 'good', uid: '../x' })), 'bad-uid'));
  await t('unknown user', async () => rej(recover(base({ ...mk(U, A, T), token: 'good', uid: 'ghost000001' })), 'no-user'));
  await t('account without email', async () => rej(recover(base({ ...mk(U, A, T), token: 'good', uid: 'noemail001' })), 'no-email'));
  _hits.clear();
  await t('rate limit after 10', async () => { const m = mk(U, A, T); for (let i = 0; i < 10; i++) await recover(base({ ...m, token: 'good', uid: 'patient0001' })); await rej(recover(base({ ...m, token: 'good', uid: 'patient0001' })), 'rate-limited'); });
  console.log(ok.join('\n'));
})();
