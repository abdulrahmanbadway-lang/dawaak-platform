// سلة الطلب (على الجهاز فقط، localStorage). الطلب بيتم من صيدلية واحدة بس.
import { useEffect, useState } from 'react';

const KEY = 'dw_cart';
const empty = () => ({ pid: null, pname: '', items: {} });
const read = () => { try { const c = JSON.parse(localStorage.getItem(KEY) || 'null'); return c && c.items ? c : empty(); } catch { return empty(); } };
let cart = read();
const subs = new Set();
const save = (c) => { cart = c; try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* ignore */ } subs.forEach((f) => f(c)); };

export const getCart = () => cart;
export const cartCount = (c = cart) => Object.values(c.items).reduce((s, x) => s + x.qty, 0);
export const cartTotal = (c = cart) => Object.values(c.items).reduce((s, x) => s + x.price * x.qty, 0);
export const clearCart = () => save(empty());
export function addToCart(p, ph) {
  // p: مستند منتج (id, pharmacyId, name, dose, price, stock, imageUrl) · ph: اسم الصيدلية
  const snap = { id: p.id, name: p.name, dose: p.dose || '', price: p.price, stock: p.stock, imageUrl: p.imageUrl || '' };
  const cur = cart.pid === p.pharmacyId ? cart.items[p.id]?.qty || 0 : 0;
  if (cur >= p.stock) return 'max';
  const base = cart.pid === p.pharmacyId ? cart : { pid: p.pharmacyId, pname: ph || '', items: {} };
  save({ ...base, pname: ph || base.pname, items: { ...base.items, [p.id]: { ...snap, qty: cur + 1 } } });
  return 'ok';
}
export const needsSwitch = (pharmacyId) => cart.pid && cart.pid !== pharmacyId && Object.keys(cart.items).length > 0;
export function setQty(id, qty) {
  const items = { ...cart.items };
  if (!items[id]) return;
  if (qty <= 0) delete items[id]; else items[id] = { ...items[id], qty: Math.min(qty, items[id].stock) };
  save(Object.keys(items).length ? { ...cart, items } : empty());
}
export function useCart() {
  const [c, set] = useState(cart);
  useEffect(() => { subs.add(set); set(cart); return () => { subs.delete(set); }; }, []);
  return c;
}
