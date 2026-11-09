import { useEffect, useRef, useState } from 'react';
import { fitZoom, project, TILE } from './lib/map.js';

// خريطة خفيفة: بلاطات OpenStreetMap + علامات، بتتظبط لوحدها عشان تظهر كل النقط (من غير مكتبة ولا API key)
// points: [{ lat, lng, emoji, label, cls }]
export default function TileMap({ points, height = 340 }) {
  const box = useRef(null), [w, setW] = useState(360), [dz, setDz] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const f = () => setW(el.clientWidth || 360);
    f();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(f);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const pts = points.filter((p) => p && p.lat != null && p.lng != null);
  if (!pts.length) return <div className="card center"><p className="mu">مفيش مواقع نعرضها لسه.</p></div>;
  const z = Math.max(3, Math.min(19, fitZoom(pts, w, height) + dz)), n = 2 ** z;
  const px = pts.map((p) => ({ ...p, ...project(p, z) })), xs = px.map((p) => p.x), ys = px.map((p) => p.y);
  const left = (Math.min(...xs) + Math.max(...xs)) / 2 - w / 2, top = (Math.min(...ys) + Math.max(...ys)) / 2 - height / 2;
  const tiles = [];
  for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + height) / TILE); ty++)
    for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + w) / TILE); tx++)
      if (ty >= 0 && ty < n) tiles.push({ k: tx + '_' + ty, x: tx * TILE - left, y: ty * TILE - top, src: `https://tile.openstreetmap.org/${z}/${((tx % n) + n) % n}/${ty}.png` });
  const c = px.find((p) => p.cls === 'c'), d = px.find((p) => p.cls === 'd');
  return (
    <div className="tmap" ref={box} style={{ height }} dir="ltr">
      {tiles.map((t) => <img key={t.k} className="tile" src={t.src} alt="" draggable="false" style={{ left: t.x, top: t.y }} />)}
      {c && d && <svg width={w} height={height}><line x1={c.x - left} y1={c.y - top} x2={d.x - left} y2={d.y - top} stroke="#1A78B0" strokeWidth="3" strokeDasharray="7 6" /></svg>}
      {px.map((p, i) => <div key={i} className={'mk ' + (p.cls || '')} style={{ left: p.x - left, top: p.y - top }}><span className="pin">{p.emoji}</span>{p.label && <small>{p.label}</small>}</div>)}
      <div className="tzoom"><button type="button" aria-label="تكبير" onClick={() => setDz((v) => Math.min(v + 1, 3))}>＋</button><button type="button" aria-label="تصغير" onClick={() => setDz((v) => Math.max(v - 1, -3))}>−</button></div>
      <span className="tattr">© OpenStreetMap</span>
    </div>
  );
}
