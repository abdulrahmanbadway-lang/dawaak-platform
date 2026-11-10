import { useEffect, useRef, useState } from 'react';
import { km as dist } from './geo.js';

// مسار سواقة حقيقي من OSRM (خدمة عامة مجانية للتجارب). لو فشلت بنرجع لتقدير بالمسافة المستقيمة.
const URL_ = 'https://router.project-osrm.org/route/v1/driving/';
export async function fetchRoute(a, b, signal) {
  const r = await fetch(`${URL_}${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`, { signal });
  if (!r.ok) throw new Error('osrm ' + r.status);
  const j = await r.json(), rt = j.routes && j.routes[0];
  if (!rt) throw new Error('no route');
  let pts = rt.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
  if (pts.length > 400) { const st = Math.ceil(pts.length / 400); pts = pts.filter((_, i) => i % st === 0 || i === pts.length - 1); }
  return { pts, km: rt.distance / 1000, min: rt.duration / 60 };
}

// بيحدّث المسار لما "from" يتحرك أكتر من 120 متر أو كل 45 ثانية، من غير ما يضغط على الخدمة
export function useDriveRoute(from, to) {
  const [rt, setRt] = useState(null), last = useRef({ t: 0, lat: null, lng: null, key: '' });
  const fl = from ? from.lat : null, fg = from ? from.lng : null, tl = to ? to.lat : null, tg = to ? to.lng : null;
  useEffect(() => {
    if (fl == null || tl == null) { setRt(null); return; }
    const L = last.current, key = tl + ',' + tg, now = Date.now();
    const moved = L.lat == null ? 1e9 : dist({ lat: fl, lng: fg }, L) * 1000;
    if (L.key === key && now - L.t < 45000 && moved < 120) return;
    L.t = now; L.lat = fl; L.lng = fg; L.key = key;
    const ac = new AbortController(), to_ = setTimeout(() => ac.abort(), 7000);
    fetchRoute({ lat: fl, lng: fg }, { lat: tl, lng: tg }, ac.signal).then((r) => setRt({ ...r, ok: true })).catch(() => setRt(null)).finally(() => clearTimeout(to_));
    return () => { clearTimeout(to_); };
  }, [fl, fg, tl, tg]);
  return rt;
}
