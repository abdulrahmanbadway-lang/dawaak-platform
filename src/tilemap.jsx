import { useCallback, useEffect, useRef, useState } from 'react';
import { fitZoom, project, unproject, mPerPx, TILE } from './lib/map.js';
import { Icon } from './icons.jsx';
import { trs } from './lib/i18n.js';

const dpr = () => (typeof window !== 'undefined' && window.devicePixelRatio > 1.25 ? '@2x' : '');
const CARTO = (t, z, x, y) => `https://${'abcd'[(x + y) % 4]}.basemaps.cartocdn.com/rastertiles/${t}/${z}/${x}/${y}${dpr()}.png`;
const OSM = (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
const isDark = () => typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark';

// حركة ناعمة للعلامة بين الموقع القديم والجديد
export function useSmooth(p, ms = 900) {
  const [v, setV] = useState(p), cur = useRef(p);
  const lat = p ? p.lat : null, lng = p ? p.lng : null;
  useEffect(() => {
    if (lat == null) { cur.current = null; setV(null); return; }
    const from = cur.current, to = { lat, lng };
    if (!from) { cur.current = to; setV(to); return; }
    let raf, t0;
    const step = (t) => {
      t0 = t0 || t;
      const k = Math.min(1, (t - t0) / ms), e = k < 0.5 ? 2 * k * k : 1 - ((-2 * k + 2) ** 2) / 2;
      const q = { lat: from.lat + (to.lat - from.lat) * e, lng: from.lng + (to.lng - from.lng) * e };
      cur.current = q; setV(q);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [lat, lng, ms]);
  return v;
}

// خريطة تفاعلية خفيفة (سحب + تكبير بالعجلة/الإصبعين/الأزرار) فوق بلاطات CARTO/OpenStreetMap، من غير مكتبة ولا API key
// markers: [{ id, kind: 'pharmacy'|'dest'|'courier', lat, lng, label, heading, acc }]   route/trail: [[lat,lng],…]
export default function TileMap({ markers, route, trail, height = 380 }) {
  const box = useRef(null), [size, setSize] = useState({ w: 360, h: height }), [dark, setDark] = useState(isDark());
  const [view, setView] = useState(null), [follow, setFollow] = useState(true);
  const ptrs = useRef(new Map()), pinch = useRef(null), vref = useRef(null);
  vref.current = view;

  useEffect(() => {
    const el = box.current; if (!el) return;
    const f = () => setSize({ w: el.clientWidth || 360, h: el.clientHeight || height });
    f();
    let ro; if (typeof ResizeObserver !== 'undefined') { ro = new ResizeObserver(f); ro.observe(el); }
    const mo = new MutationObserver(() => setDark(isDark()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => { if (ro) ro.disconnect(); mo.disconnect(); };
  }, [height]);

  const pts = (markers || []).filter((m) => m && m.lat != null && m.lng != null);
  const sig = pts.map((p) => p.lat.toFixed(5) + p.lng.toFixed(5)).join('|') + '|' + size.w + 'x' + size.h;
  // وضع "التمركز التلقائي": بيظبط الإطار على كل النقط (والمسار) كل ما حاجة تتحرك
  useEffect(() => {
    if (!follow || !pts.length) return;
    const all = pts.map((p) => ({ lat: p.lat, lng: p.lng }));
    const z = Math.min(17, fitZoom(all, size.w, size.h, 64)), ps = all.map((p) => project(p, z));
    const xs = ps.map((p) => p.x), ys = ps.map((p) => p.y);
    const c = unproject({ x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 }, z);
    setView({ lat: c.lat, lng: c.lng, z });
  }, [sig, follow]); // eslint-disable-line react-hooks/exhaustive-deps

  const move = useCallback((dx, dy) => {
    const v = vref.current; if (!v) return;
    const c = project(v, v.z), n = unproject({ x: c.x - dx, y: c.y - dy }, v.z);
    setView({ ...v, lat: Math.max(-84, Math.min(84, n.lat)), lng: n.lng });
  }, []);
  const zoom = useCallback((d) => { setFollow(false); const v = vref.current; if (v) setView({ ...v, z: Math.max(3, Math.min(19, v.z + d)) }); }, []);

  const down = (e) => { if (e.target.closest && e.target.closest('.tctl')) return; e.currentTarget.setPointerCapture?.(e.pointerId); ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (ptrs.current.size === 2) { const [a, b] = [...ptrs.current.values()]; pinch.current = Math.hypot(a.x - b.x, a.y - b.y); } };
  const mv = (e) => {
    const p = ptrs.current.get(e.pointerId); if (!p) return;
    const nx = { x: e.clientX, y: e.clientY };
    if (ptrs.current.size === 1) { setFollow(false); move(nx.x - p.x, nx.y - p.y); }
    ptrs.current.set(e.pointerId, nx);
    if (ptrs.current.size === 2 && pinch.current) {
      const [a, b] = [...ptrs.current.values()], d = Math.hypot(a.x - b.x, a.y - b.y), r = d / pinch.current;
      if (r > 1.45) { zoom(1); pinch.current = d; } else if (r < 0.69) { zoom(-1); pinch.current = d; }
    }
  };
  const up = (e) => { ptrs.current.delete(e.pointerId); if (ptrs.current.size < 2) pinch.current = null; };
  useEffect(() => {
    const el = box.current; if (!el) return;
    let lock = 0;
    const w = (e) => { e.preventDefault(); const t = Date.now(); if (t - lock < 220) return; lock = t; zoom(e.deltaY < 0 ? 1 : -1); };
    el.addEventListener('wheel', w, { passive: false });
    return () => el.removeEventListener('wheel', w);
  }, [zoom]);

  const shown = [];
  let left = 0, top = 0, z = 0, n = 1;
  if (view) {
    z = Math.round(view.z); n = 2 ** z;
    const c = project(view, z); left = c.x - size.w / 2; top = c.y - size.h / 2;
    for (let ty = Math.floor(top / TILE); ty <= Math.floor((top + size.h) / TILE); ty++)
      for (let tx = Math.floor(left / TILE); tx <= Math.floor((left + size.w) / TILE); tx++)
        if (ty >= 0 && ty < n) { const wx = ((tx % n) + n) % n; shown.push({ k: z + '_' + tx + '_' + ty, x: tx * TILE - left, y: ty * TILE - top, z, wx, ty }); }
  }
  const at = (p) => { const q = project(p, z); return { x: q.x - left, y: q.y - top }; };
  const line = (arr) => arr && arr.length > 1 ? arr.map(([la, ln], i) => { const q = at({ lat: la, lng: ln }); return (i ? 'L' : 'M') + q.x.toFixed(1) + ' ' + q.y.toFixed(1); }).join('') : '';
  const theme = dark ? 'dark_all' : 'voyager';

  return (
    <div className="tmap" ref={box} style={{ height }} dir="ltr" onPointerDown={down} onPointerMove={mv} onPointerUp={up} onPointerCancel={up} onDoubleClick={() => zoom(1)}>
      {!pts.length && <div className="tempty">{trs("مفيش مواقع نعرضها لسه")}</div>}
      {shown.map((t) => <img key={t.k + theme} className="tile" src={CARTO(theme, t.z, t.wx, t.ty)} alt="" draggable="false" style={{ left: t.x, top: t.y }}
        onError={(e) => { if (!e.target.dataset.f) { e.target.dataset.f = 1; e.target.src = OSM(t.z, t.wx, t.ty); } }} />)}
      {view && (
        <svg className="tsvg" width={size.w} height={size.h}>
          {route && route.length > 1 && <><path d={line(route)} className="rt-case" /><path d={line(route)} className="rt-main" /></>}
          {trail && trail.length > 1 && <path d={line(trail)} className="rt-trail" />}
          {pts.filter((p) => p.acc > 20).map((p) => { const q = at(p); return <circle key={'a' + p.id} className="acc" cx={q.x} cy={q.y} r={Math.min(120, p.acc / mPerPx(p.lat, z))} />; })}
        </svg>
      )}
      {view && pts.map((p) => {
        const q = at(p);
        return (
          <div key={p.id} className={'mk ' + p.kind} style={{ left: q.x, top: q.y }}>
            <span className="pin">
              {p.kind === 'courier' && <i className="pulse"></i>}
              {p.kind === 'courier' && p.heading != null && <b className="hdg" style={{ transform: `rotate(${p.heading}deg)` }}></b>}
              <Icon n={p.kind === 'pharmacy' ? 'store' : p.kind === 'dest' ? 'home' : 'truck'} s={p.kind === 'courier' ? 22 : 19} />
            </span>
            {p.label && <small>{p.label}</small>}
          </div>
        );
      })}
      <div className="tctl">
        <button type="button" aria-label={trs("تكبير")} onClick={() => zoom(1)}><Icon n="plus" s={18} /></button>
        <button type="button" aria-label={trs("تصغير")} onClick={() => zoom(-1)}><Icon n="minus" s={18} /></button>
        <button type="button" aria-label={trs("إعادة التمركز")} className={follow ? 'on' : ''} onClick={() => setFollow(true)}><Icon n="target" s={18} /></button>
      </div>
      <span className="tattr">© OpenStreetMap · © CARTO</span>
    </div>
  );
}
