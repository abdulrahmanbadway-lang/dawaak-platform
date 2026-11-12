// المفضلة (على الجهاز فقط، localStorage) — بنحفظ اسم المنتج لأن نفس المنتج بيتباع في أكتر من صيدلية.
import { useEffect, useState } from 'react';

const KEY = 'dw_favs';
const read = () => { try { const a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a.filter((x) => typeof x === 'string').slice(0, 300) : []; } catch { return []; } };
let favs = read();
const subs = new Set();
export const isFav = (n) => favs.includes(n);
export function toggleFav(n) {
  favs = favs.includes(n) ? favs.filter((x) => x !== n) : [n, ...favs].slice(0, 300);
  try { localStorage.setItem(KEY, JSON.stringify(favs)); } catch { /* ignore */ }
  subs.forEach((f) => f(favs));
}
export function useFavs() {
  const [f, set] = useState(favs);
  useEffect(() => { subs.add(set); set(favs); return () => { subs.delete(set); }; }, []);
  return f;
}
