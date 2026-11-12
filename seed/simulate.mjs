// بيحرّك المناديب اللي "في الطريق" على الخريطة بين الصيدلية والمريض (للعرض). وقّفه بـ Ctrl+C.
import { ACCOUNTS, COURIERS, ORDERS, PATIENTS, PHARMACIES, commit, findUser, getToken, idOf, projectId } from './lib.mjs';

const pid = projectId(), tok = await getToken();
const jobs = [];
for (const [n, pk, pi, status, , , ck] of ORDERS) {
  if (status !== 'out' || !ck) continue;
  const cuid = await findUser(tok, pid, `${ck}@dawaak.test`);
  if (!cuid) { console.error('✗ شغّل node seed/seed.mjs الأول'); process.exit(1); }
  jobs.push({ n, cuid, a: PHARMACIES[pi], b: PATIENTS.find((p) => p.key === pk) });
}
console.log(`▶ بحرّك ${jobs.length} مندوب. Ctrl+C للإيقاف.`);
let k = 0;
for (;;) {
  const t = (k % 40) / 40, f = t < 0.5 ? t * 2 : 2 - t * 2, now = new Date(); // رايح جاي
  await commit(tok, pid, jobs.map((j) => ({ path: `tracking/${idOf.order(j.n)}`, data: { courierId: j.cuid, lat: +(j.a.lat + (j.b.lat - j.a.lat) * f).toFixed(6), lng: +(j.a.lng + (j.b.lng - j.a.lng) * f).toFixed(6), acc: 10, speed: 6, heading: t < 0.5 ? 70 : 250, updatedAt: now } })));
  process.stdout.write('.'); k++;
  await new Promise((r) => setTimeout(r, 3000));
}
