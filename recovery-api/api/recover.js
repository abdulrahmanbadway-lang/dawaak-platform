// Vercel Serverless Function: POST /api/recover  { uid }   Authorization: Bearer <Firebase ID token بتاع أدمن>
const admin = require('firebase-admin');
const { recover, HttpError } = require('../lib.js');

function init() {
  if (admin.apps.length) return;
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!b64) throw new HttpError(500, 'not-configured', 'FIREBASE_SERVICE_ACCOUNT_B64 مش متضبط');
  admin.initializeApp({ credential: admin.credential.cert(JSON.parse(Buffer.from(b64, 'base64').toString('utf8'))) });
}

module.exports = async (req, res) => {
  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.origin || '';
  if (allowed.includes(origin)) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  try {
    init();
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const token = (req.headers.authorization || '').replace(/^Bearer /, '');
    const out = await recover({ auth: admin.auth(), db: admin.firestore(), origin, allowed, token, uid: body.uid, site: process.env.SITE_URL || allowed[0] });
    return res.status(200).json(out);
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status === 500) console.error('recover failed', e);
    return res.status(status).json({ error: e instanceof HttpError ? e.code : 'server' });
  }
};
