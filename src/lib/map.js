// حسابات الخريطة (Web Mercator / بلاطات OpenStreetMap) من غير أي مكتبة خارجية
export const TILE = 256;
export const project = ({ lat, lng }, z) => {
  const s = Math.sin((Math.max(-85.05, Math.min(85.05, lat)) * Math.PI) / 180), k = TILE * 2 ** z;
  return { x: ((lng + 180) / 360) * k, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * k };
};
// أكبر زووم بيخلّي كل النقط جوه الإطار
export function fitZoom(pts, w, h, pad = 70) {
  if (pts.length < 2) return 16;
  for (let z = 17; z >= 3; z--) {
    const p = pts.map((q) => project(q, z)), xs = p.map((a) => a.x), ys = p.map((a) => a.y);
    if (Math.max(...xs) - Math.min(...xs) <= w - 2 * pad && Math.max(...ys) - Math.min(...ys) <= h - 2 * pad) return z;
  }
  return 3;
}
// تقدير زمن الوصول: مسافة مستقيمة × 1.3 (تعرّج الشوارع) على السرعة الحالية (أو 22 كم/س لو واقف/مفيش سرعة)
export const etaMin = (km, speedMs) => {
  const kmh = speedMs != null && speedMs * 3.6 > 8 ? speedMs * 3.6 : 22;
  return Math.max(1, Math.round(((km * 1.3) / kmh) * 60));
};
