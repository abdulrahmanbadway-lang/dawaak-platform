// منطق الاسترجاع (من غير اعتماد مباشر على firebase-admin علشان نقدر نختبره): بياخد { auth, db } جاهزين.
const HOUR = 3600;
const hits = new Map(); // تحديد معدّل بسيط لكل أدمن (best effort في بيئة serverless)

class HttpError extends Error { constructor(status, code, msg) { super(msg || code); this.status = status; this.code = code; } }

function rateLimit(uid, now, max = 10, win = 600000) {
  const l = (hits.get(uid) || []).filter((t) => now - t < win);
  if (l.length >= max) throw new HttpError(429, 'rate-limited', 'محاولات كتير، استنى شوية');
  l.push(now); hits.set(uid, l);
}

// origin: ترويسة Origin من الطلب، allowed: قايمة النطاقات المسموحة، token: Firebase ID token بتاع الأدمن، uid: الحساب المطلوب استرجاعه
async function recover({ auth, db, origin, allowed, token, uid, site, now = Date.now() }) {
  if (!allowed.includes(origin)) throw new HttpError(403, 'bad-origin');
  if (!token) throw new HttpError(401, 'no-token');
  let dec;
  try { dec = await auth.verifyIdToken(token); } catch { throw new HttpError(401, 'bad-token'); }
  // لازم يكون الأدمن سجّل دخول خلال آخر ساعة (بيحمي من توكن قديم مسروق)
  if (!dec.auth_time || now / 1000 - dec.auth_time > HOUR) throw new HttpError(401, 'recent-login');
  const me = await db.doc('users/' + dec.uid).get();
  if (!me.exists || me.data().role !== 'admin' || me.data().blocked === true) throw new HttpError(403, 'not-admin');
  rateLimit(dec.uid, now);
  if (typeof uid !== 'string' || !/^[A-Za-z0-9]{10,64}$/.test(uid)) throw new HttpError(400, 'bad-uid');
  const t = await db.doc('users/' + uid).get();
  if (!t.exists) throw new HttpError(404, 'no-user');
  const td = t.data();
  if (td.role === 'admin') throw new HttpError(403, 'target-admin', 'مينفعش استرجاع حساب أدمن بالطريقة دي');
  let u;
  try { u = await auth.getUser(uid); } catch { throw new HttpError(404, 'no-auth-user'); }
  if (!u.email) throw new HttpError(422, 'no-email');
  const link = await auth.generatePasswordResetLink(u.email, { url: site });
  await db.collection('recoveryAudit').add({ by: dec.uid, target: uid, at: now });
  return { link, name: td.name || '', phone: td.phone || null };
}

module.exports = { recover, HttpError, _hits: hits };
