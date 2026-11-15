import { Icon } from '../../icons.jsx';
import { Empty, Kpi, RECENT_MS, ROLE, ST, ago, dayKey, money, ms } from './common.jsx';

export default function Overview({ sessions, online, users, phs, orders, now }) {
  const day0 = new Date(now); day0.setHours(0, 0, 0, 0);
  const today = (orders || []).filter((o) => ms(o.createdAt) >= day0.getTime());
  const active = (orders || []).filter((o) => ['new', 'preparing', 'out'].includes(o.status));
  const sales = (orders || []).filter((o) => o.status === 'done').reduce((s, o) => s + (o.total || 0), 0);
  const members = online.filter((s) => s.uid).length;
  const by = (r) => (users || []).filter((u) => u.role === r).length;
  const pending = (phs || []).filter((p) => !p.verified).length;
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(day0); d.setDate(d.getDate() - (6 - i)); return d; });
  const bars = days.map((d) => ({ d, n: (orders || []).filter((o) => ms(o.createdAt) && dayKey(ms(o.createdAt)) === d.toDateString()).length }));
  const max = Math.max(1, ...bars.map((b) => b.n));
  const feed = [
    ...(orders || []).flatMap((o) => {
      const c = ms(o.createdAt), u = ms(o.updatedAt);
      const e = [{ t: c, ic: 'bag', tx: `طلب جديد من ${o.patientName || '—'} لصيدلية ${o.pharmacyName || '—'} (${money(o.total)})` }];
      if (u && c && u - c > 5000 && o.status !== 'new') e.push({ t: u, ic: o.status === 'out' ? 'truck' : o.status === 'done' ? 'check' : o.status === 'cancelled' ? 'x' : 'clock', tx: `الطلب ${o.id.slice(0, 6)} (${o.patientName || '—'}) ← ${ST[o.status] || o.status}` });
      return e;
    }),
    ...(users || []).map((u) => ({ t: ms(u.createdAt), ic: 'user', tx: `انضم ${u.name} (${ROLE[u.role] || u.role})` })),
  ].filter((e) => e.t).sort((a, b) => b.t - a.t).slice(0, 14);
  return (
    <>
      <div className="adm-grid">
        <Kpi ic="bolt" tone="gr" v={online.length} l="على الموقع دلوقتي" sub={`${members} مسجّل · ${online.length - members} زائر`} />
        <Kpi ic="clock" v={sessions.filter((s) => now - s.t <= RECENT_MS).length} l="نشطين آخر 15 دقيقة" />
        <Kpi ic="users" v={users ? users.length : '…'} l="إجمالي المستخدمين" sub={`${by('patient')} مريض · ${by('pharmacy')} صيدلية · ${by('courier')} مندوب`} />
        <Kpi ic="store" tone={pending ? 'am' : ''} v={phs ? phs.length : '…'} l="الصيدليات" sub={pending ? `${pending} في انتظار التوثيق` : 'كلها موثّقة'} />
        <Kpi ic="bag" v={today.length} l="طلبات النهارده" sub={`${active.length} قيد التنفيذ دلوقتي`} />
        <Kpi ic="check" tone="gr" v={money(sales)} l="مبيعات مسلّمة" sub="من آخر 200 طلب" />
      </div>
      <div className="adm-two">
        <section className="card"><h3>الطلبات آخر 7 أيام</h3>
          <div className="adm-bars">{bars.map((b) => <div key={b.d.getTime()} className="bar"><span>{b.n}</span><i style={{ height: Math.max(4, (b.n / max) * 100) + '%' }} /><small>{b.d.toLocaleDateString('ar-EG', { weekday: 'short' })}</small></div>)}</div>
        </section>
        <section className="card"><h3>آخر الأحداث</h3>
          <p className="mu sm2">من الطلبات وتسجيل الحسابات (مش من تتبع الصفحات).</p>
          {feed.length ? <ul className="adm-feed">{feed.map((e, i) => <li key={i}><i><Icon n={e.ic} s={16} /></i><span>{e.tx}</span><small>{ago(e.t, now)}</small></li>)}</ul> : <Empty>مفيش أحداث لسه</Empty>}
        </section>
      </div>
    </>
  );
}
