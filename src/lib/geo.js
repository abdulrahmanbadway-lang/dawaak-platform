export const km = (a, b) => {
  const r = (x) => (x * Math.PI) / 180, R = 6371;
  const dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
export const fmtKm = (d) => (d < 1 ? Math.round(d * 1000) + ' م' : d.toFixed(1) + ' كم');
export const getPos = () => new Promise((ok, no) => {
  if (!navigator.geolocation) return no(new Error('no geo'));
  navigator.geolocation.getCurrentPosition((p) => ok({ lat: p.coords.latitude, lng: p.coords.longitude }), no, { timeout: 10000 });
});
