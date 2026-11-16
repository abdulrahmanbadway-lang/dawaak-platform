import { Icon } from '../../icons.jsx';
import { Badge } from '../../ui.jsx';
import { RX_LABEL, RX_TONE } from '../../lib/status.js';
import { Empty, Kpi, RECENT_MS, ROLE, ST, ST_C, ago, dayKey, money, ms } from './common.jsx';

export default function Overview({ sessions, online, users, phs, orders, rxNew, rxLast, now, go }) {
  const day0 = new Date(now); day0.setHours(0, 0, 0, 0);
  const today = (orders || []).filter((o) => ms(o.createdAt) >= day0.getTime());
  const active = (orders || []).filter((o) => ['new', 'preparing', 'out'].includes(o.status));
  const sales = (orders || []).filter((o) => o.status === 'done').reduce((s, o) => s + (o.total || 0), 0);
  const members = online.filter((s) => s.uid).length;
  const by = (r) => (users || []).filter((u) => u.role === r).length;
  const pending = (phs || []).filter((p) => !p.verified).length;
  const newOrders = (orders || []).filter((o) => o.status === 'new').length;
  const blocked = (users || []).filter((u) => u.blocked === true).length;
  const alerts = [
    newOrders > 0 && ['bag', `${newOrders} طلب جديد مستني الصيدلية`, 'orders'],
    rxNew > 0 && ['rx', `${rxNew} روشتة مستنية رد الصيدلي`, 'rx'],
    pending > 0 && ['store', `${pending} صيدلية في انتظار التوثيق`, 'pharmacies'],
  ].filter(Boolean);
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
      {orders && phs ? (alerts.length
        ? <div className="adm-alerts" role="status">{alerts.map(([ic, tx, t]) => <button key={t} onClick={() => go(t)}><Icon n={ic} s={16} />{tx}<small>افتح ←</small></button>)}</div>
        : <div className="adm-alerts ok" role="status"><span><Icon n="check" s={16} />مفيش حاجة محتاجة انتباه دلوقتي</span></div>) : null}
      <div className="adm-grid">
        <Kpi ic="bolt" tone="gr" v={online.length} l="على الموقع دلوقتي" sub={`${members} مسجّل · ${online.length - members} زائر`} />
        <Kpi ic="clock" v={sessions.filter((s) => now - s.t <= RECENT_MS).length} l="نشطين آخر 15 دقيقة" />
        <Kpi ic="users" v={users ? users.length : '…'} l="إجمالي المستخدمين" sub={`${by('patient')} مريض · ${by('pharmacy')} صيدلية · ${by('courier')} مندوب`} />
        <Kpi ic="store" tone={pending ? 'am' : ''} v={phs ? phs.length : '…'} l="الصيدليات" sub={pending ? `${pending} في انتظار التوثيق` : 'كلها موثّقة'} />
        <Kpi ic="bag" v={today.length} l="طلبات النهارده" sub={`${active.length} قيد التنفيذ دلوقتي`} />
        <Kpi ic="check" tone="gr" v={money(sales)} l="مبيعات مسلّمة" sub="من آخر 200 طلب" />
        <Kpi ic="rx" tone={rxNew ? 'am' : ''} v={rxNew == null ? '…' : rxNew} l="روشتات معلّقة" sub="بانتظار رد الصيدلي" />
        <Kpi ic="shield" tone={blocked ? 'rd' : ''} v={users ? blocked : '…'} l="حسابات محظورة" />
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
      <div className="adm-two">
        <section className="card"><div className="row between g"><h3>آخر الطلبات</h3><button className="btn o sm" onClick={() => go('orders')}>كل الطلبات</button></div>
          {!orders ? <Empty>جاري التحميل…</Empty> : !orders.length ? <Empty>مفيش طلبات لسه</Empty> :
            <ul className="adm-feed">{orders.slice(0, 6).map((o) => <li key={o.id}><span><b>{o.patientName || '—'}</b> ← {o.pharmacyName || '—'} · {money(o.total)}</span><Badge c={ST_C[o.status] || ''}>{ST[o.status] || o.status}</Badge><small>{ago(ms(o.createdAt), now)}</small></li>)}</ul>}</section>
        <section className="card"><div className="row between g"><h3>آخر الروشتات</h3><button className="btn o sm" onClick={() => go('rx')}>كل الروشتات</button></div>
          {!rxLast ? <Empty>جاري التحميل…</Empty> : !rxLast.length ? <Empty>مفيش روشتات لسه</Empty> :
            <ul className="adm-feed">{rxLast.map((r) => <li key={r.id} className={r.status === 'pending' ? 'adm-hl' : ''}><span><b>{r.patientName || '—'}</b> ← {r.pharmacyName || '—'} · {r.nImages} صورة</span><Badge c={RX_TONE[r.status] || ''}>{RX_LABEL[r.status] || r.status}</Badge><small>{ago(ms(r.createdAt), now)}</small></li>)}</ul>}</section>
      </div>
    </>
  );
}
