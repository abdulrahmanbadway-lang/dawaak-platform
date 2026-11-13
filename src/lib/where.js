// موقع المستخدم: بنطلبه أول ما يدخل (المتصفح هو اللي بياخد موافقته)، وبنحدد منه أقرب محافظة.
// - الإحداثيات الدقيقة بتفضل على جهازه بس (localStorage) وبتُستخدم لترتيب الصيدليات بالأقرب.
// - للسيرفر بيروح بس: المحافظة + إحداثيات متقرّبة لحوالي كيلومتر (presence)، عشان الإدارة تفهم احتياج كل منطقة.
// - لو رفض: بيقدر يختار محافظته يدوياً، ومفيش أي موقع بيتسجّل.
import { useEffect, useState } from 'react';
import { nearestGov } from './egypt.js';

const KEY = 'dw_loc', DENY = 'dw_loc_deny', FRESH = 10 * 60000, DENY_FOR = 3 * 864e5;
const ls = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  del: (k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};
const read = () => { try { const o = JSON.parse(ls.get(KEY) || 'null'); if (o && typeof o.gov === 'string') return o; } catch { /* ignore */ } return null; };
let cur = read(); const subs = new Set();
const save = (o) => { cur = o; if (o) ls.set(KEY, JSON.stringify(o)); else ls.del(KEY); subs.forEach((f) => f()); };

export const getWhere = () => cur;
export function useWhere() {
  const [, n] = useState(0);
  useEffect(() => { const f = () => n((x) => x + 1); subs.add(f); return () => { subs.delete(f); }; }, []);
  return cur;
}
// اختيار يدوي للمحافظة (من غير إحداثيات)
export const setManualGov = (gov) => save(gov ? { gov, manual: true, ts: Date.now() } : null);
export const clearWhere = () => save(null);
// الإحداثيات بتتقرّب لـ 2 رقم عشرى (حوالي 1 كم) قبل ما تتبعت لأي حد
export const coarse = (v) => Math.round(v * 100) / 100;

// موقع دقيق: بنسمع لقراءات GPS لحد ما الدقة تبقى <= target متر (أو تخلص المهلة) ونرجّع أحسن قراءة. acc = هامش الخطأ بالمتر.
export function getPrecise({ target = 30, maxMs = 10000 } = {}) {
  return new Promise((ok, no) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return no(new Error('unsupported'));
    let best = null, wid = null, done = false, t = null;
    const stop = () => { done = true; clearTimeout(t); if (wid != null) navigator.geolocation.clearWatch(wid); };
    const fin = () => { if (done) return; stop(); best ? ok(best) : no(new Error('timeout')); };
    t = setTimeout(fin, maxMs);
    wid = navigator.geolocation.watchPosition((p) => {
      const c = { lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy || 9999) };
      if (!best || c.acc < best.acc) best = c;
      if (c.acc <= target) fin();
    }, (e) => { if (done) return; if (e && e.code === 1) { ls.set(DENY, String(Date.now())); stop(); no(e); } else fin(); },
    { enableHighAccuracy: true, timeout: maxMs, maximumAge: 0 });
  });
}
export async function askLocation() {
  const c = await getPrecise();
  ls.del(DENY); save({ lat: c.lat, lng: c.lng, acc: c.acc, gov: nearestGov(c.lat, c.lng), ts: Date.now() });
  return cur;
}
// موقع التوصيل: لو حددنا موقعه الدقيق من أقل من ساعتين نستخدمه، وإلا null
export function freshDest() { const w = cur; return w && w.lat != null && Date.now() - w.ts < 2 * 36e5 ? { lat: +w.lat.toFixed(6), lng: +w.lng.toFixed(6), acc: w.acc ?? null } : null; }
// بيتنادى مرة واحدة أول ما الموقع يفتح
let auto = false;
export async function autoLocate() {
  if (auto) return; auto = true;
  if (typeof navigator === 'undefined' || !navigator.geolocation) return;
  if (cur && cur.lat != null && Date.now() - cur.ts < FRESH) return;
  if (cur && cur.manual) return; // اختار بإيده، مانغيّرش اختياره
  const d = Number(ls.get(DENY)); if (d && Date.now() - d < DENY_FOR) return;
  try { const p = await navigator.permissions?.query({ name: 'geolocation' }); if (p && p.state === 'denied') return; } catch { /* المتصفح ما بيدعمش */ }
  askLocation().catch(() => {});
}
