// تتبّع "مين على الموقع دلوقتي" لصالح لوحة الأدمن.
// كل تبويب بيكتب نبضة (heartbeat) كل 60 ثانية وهو ظاهر، وكمان عند تغيير الصفحة.
// مهم: عنوان الـ IP هنا بيتجاب من جهة المتصفح عن طريق خدمة خارجية (Cloudflare ثم ipify)، يعني:
//  - مش مضمون (المستخدم ممكن يمنعه أو يزوّره)، ولو الخدمتين اتحجبوا بيتسجّل فاضي.
//  - الـ IP الحقيقي المضمون محتاج خادم (Cloud Functions) وده مش متاح في خطة Spark المجانية.
import { useEffect } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, configured } from '../firebase.js';

const store = {
  get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* ignore */ } },
};

export const HEARTBEAT_MS = 60000;

function sessionId() {
  let s = store.get('dw_sid');
  if (!s || !/^v_[a-z0-9]{6,24}$/.test(s)) {
    s = 'v_' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36).slice(-4);
    s = s.replace(/[^a-z0-9_]/g, '').slice(0, 26);
    store.set('dw_sid', s);
  }
  return s;
}

export function deviceInfo() {
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad|iPod/i.test(ua) ? 'iOS' : /Windows/i.test(ua) ? 'Windows' : /Mac OS/i.test(ua) ? 'macOS' : /Linux/i.test(ua) ? 'Linux' : '';
  const br = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
  return { dev: [os, br].filter(Boolean).join(' · ').slice(0, 60), mobile: /Android|iPhone|iPad|iPod|Mobile/i.test(ua) };
}

const cleanIp = (v) => (typeof v === 'string' && v.length <= 45 && /^[0-9a-fA-F:.]+$/.test(v) ? v : '');

async function fetchWithTimeout(url) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 4000);
  try { return await fetch(url, { signal: ac.signal, cache: 'no-store' }); } finally { clearTimeout(t); }
}

let ipPromise = null;
export function lookupIp() {
  if (ipPromise) return ipPromise;
  const cached = store.get('dw_ip');
  if (cached) { try { const c = JSON.parse(cached); if (c.ip) return (ipPromise = Promise.resolve(c)); } catch { /* ignore */ } }
  ipPromise = (async () => {
    let out = { ip: '', cc: '' };
    try {
      const tx = await (await fetchWithTimeout('https://www.cloudflare.com/cdn-cgi/trace')).text();
      const m = Object.fromEntries(tx.trim().split('\n').map((l) => l.split('=')));
      out = { ip: cleanIp(m.ip), cc: /^[A-Za-z]{2}$/.test(m.loc || '') ? m.loc.toUpperCase() : '' };
    } catch { /* جرّب الخدمة التانية */ }
    if (!out.ip) {
      try { out.ip = cleanIp((await (await fetchWithTimeout('https://api.ipify.org?format=json')).json()).ip); } catch { /* ignore */ }
    }
    if (out.ip) store.set('dw_ip', JSON.stringify(out)); else ipPromise = null; // لو فشل نحاول تاني في النبضة الجاية
    return out;
  })();
  return ipPromise;
}

// ready: بعد ما حالة الدخول تتحدد (عشان ما نكتبش مستند زائر ثم مستند مستخدم لنفس الشخص)
export function usePresence(ready, uid, path) {
  useEffect(() => {
    if (!configured || !ready) return undefined;
    let dead = false;
    const id = uid || sessionId();
    if (!store.get('dw_since')) store.set('dw_since', String(Date.now()));
    const since = Number(store.get('dw_since')) || Date.now();
    const beat = async () => {
      if (dead || document.hidden) return;
      const net = await lookupIp();
      if (dead) return;
      const d = {
        uid: uid || null, path: String(path || '/').slice(0, 80), since, lastSeen: serverTimestamp(), ...deviceInfo(),
        ...(net.ip ? { ip: net.ip } : {}), ...(net.cc ? { cc: net.cc } : {}), ...(uid ? {} : { sid: id }),
      };
      setDoc(doc(db, 'presence', id), d, { merge: true }).catch(() => { /* الأدمن مش هيشوفنا بس؛ ده مش خطأ للمستخدم */ });
    };
    beat();
    const t = setInterval(beat, HEARTBEAT_MS);
    const vis = () => { if (!document.hidden) beat(); };
    document.addEventListener('visibilitychange', vis);
    return () => { dead = true; clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, [ready, uid, path]);
}
