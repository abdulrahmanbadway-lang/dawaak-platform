// موقع المستخدم: بنطلبه أول ما يدخل (المتصفح هو اللي بياخد موافقته)، وبنحدد منه أقرب محافظة.
// - الإحداثيات الدقيقة بتفضل على جهازه بس (localStorage) وبتُستخدم لترتيب الصيدليات بالأقرب.
// - للسيرفر بيروح بس: المحافظة + إحداثيات متقرّبة لحوالي كيلومتر (presence)، عشان الإدارة تفهم احتياج كل منطقة.
// - لو رفض: بيقدر يختار محافظته يدوياً، ومفيش أي موقع بيتسجّل.
import { useEffect, useState } from 'react';
import { nearestGov } from './egypt.js';

const KEY = 'dw_loc', DENY = 'dw_loc_deny', FRESH = 6 * 36e5, DENY_FOR = 3 * 864e5;
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

export function askLocation() {
  return new Promise((ok, no) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return no(new Error('unsupported'));
    navigator.geolocation.getCurrentPosition((p) => {
      const lat = p.coords.latitude, lng = p.coords.longitude, gov = nearestGov(lat, lng);
      ls.del(DENY); save({ lat, lng, gov, ts: Date.now() }); ok(cur);
    }, (e) => { if (e && e.code === 1) ls.set(DENY, String(Date.now())); no(e); }, { timeout: 12000, maximumAge: 10 * 60000, enableHighAccuracy: false });
  });
}
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
