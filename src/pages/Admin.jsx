import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, getDocs, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useAuth } from '../auth.jsx';
import { Icon } from '../icons.jsx';
import { ON_MS, RECENT_MS, ms, useNow } from './admin/common.jsx';
import OverviewTab from './admin/OverviewTab.jsx';
import LiveTab from './admin/LiveTab.jsx';
import UsersTab from './admin/UsersTab.jsx';
import ProductImagesTab from './admin/ProductImagesTab.jsx';
import ReviewsTab from './admin/ReviewsTab.jsx';
import SettingsTab from './admin/SettingsTab.jsx';
import AreasTab from './admin/AreasTab.jsx';
import PharmaciesTab from './admin/PharmaciesTab.jsx';
import ProductsTab from './admin/ProductsTab.jsx';
import BannersTab from './admin/BannersTab.jsx';
import OrdersTab from './admin/OrdersTab.jsx';
import RxTab from './admin/RxTab.jsx';
import SystemTab from './admin/SystemTab.jsx';
import '../admin.css';

function useData() {
  const [pres, setPres] = useState(null), [orders, setOrders] = useState(null), [users, setUsers] = useState(null), [phs, setPhs] = useState(null), [err, setErr] = useState('');
  const loadStatic = useCallback(async () => {
    try {
      const [u, p] = await Promise.all([getDocs(collection(db, 'users')), getDocs(collection(db, 'pharmacies'))]);
      setUsers(u.docs.map((d) => ({ id: d.id, ...d.data() }))); setPhs(p.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) { setErr(e.code || e.message); }
  }, []);
  useEffect(() => {
    loadStatic();
    const bad = (e) => setErr(e.code || e.message);
    const a = onSnapshot(query(collection(db, 'presence'), orderBy('lastSeen', 'desc'), limit(300)), (s) => setPres(s.docs.map((d) => ({ id: d.id, ...d.data() }))), bad);
    const b = onSnapshot(query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(200)), (s) => setOrders(s.docs.map((d) => ({ id: d.id, ...d.data() }))), bad);
    return () => { a(); b(); };
  }, [loadStatic]);
  return { pres, orders, users, phs, err, reload: loadStatic, setPhs, setUsers };
}

const TABS = [['overview', 'نظرة عامة', 'home'], ['live', 'مباشر', 'bolt'], ['users', 'المستخدمون', 'users'], ['areas', 'المناطق', 'pin'], ['pharmacies', 'الصيدليات', 'store'], ['products', 'المنتجات', 'pill'], ['banners', 'الإعلانات', 'star'], ['prodimg', 'صور المنتجات', 'camera'], ['reviews', 'الآراء', 'heart'], ['contact', 'التواصل', 'chat'], ['orders', 'الطلبات', 'bag'], ['rx', 'الروشتات', 'rx'], ['system', 'النظام', 'shield']];

export default function Admin() {
  const [tab, setTab] = useState('overview');
  const { user: me } = useAuth();
  const { pres, orders, users, phs, err, reload, setPhs, setUsers } = useData();
  const now = useNow(15000);
  const uById = useMemo(() => Object.fromEntries((users || []).map((u) => [u.id, u])), [users]);
  const sessions = useMemo(() => (pres || []).map((r) => { const u = r.uid ? uById[r.uid] : null; return { ...r, u, t: ms(r.lastSeen) ?? now, name: u?.name || (r.uid ? 'مستخدم' : 'زائر'), role: u?.role || null }; }).sort((a, b) => b.t - a.t), [pres, uById, now]);
  const online = sessions.filter((s) => now - s.t <= ON_MS);
  const recent = sessions.filter((s) => now - s.t > ON_MS && now - s.t <= RECENT_MS);
  const onlineIds = useMemo(() => new Set(online.filter((s) => s.uid).map((s) => s.uid)), [online]);

  if (err) return (
    <div className="card center"><h2>مش قادر أحمّل البيانات</h2>
      <p className="mu">{/permission/i.test(err) ? 'الحساب ده مش أدمن، أو قواعد Firestore الجديدة لسه ما اتنشرتش (firebase deploy --only firestore:rules).' : err}</p></div>
  );
  return (
    <div className="adm">
      <div className="row between wrap g adm-hd">
        <div><h1>لوحة التحكم</h1><p className="mu sm2">بيانات حية · آخر تحديث للحسابات والصيدليات يدوي بزر التحديث</p></div>
        <div className="row g"><span className="adm-live"><i />مباشر</span><button className="btn o sm" onClick={reload}>تحديث</button></div>
      </div>
      <div className="adm-tabs" role="tablist">{TABS.map(([k, l, ic]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}><Icon n={ic} s={16} />{l}{k === 'live' && <b>{online.length}</b>}</button>)}</div>
      {tab === 'overview' && <OverviewTab sessions={sessions} online={online} users={users} phs={phs} orders={orders} now={now} />}
      {tab === 'live' && <LiveTab sessions={sessions} online={online} recent={recent} now={now} />}
      {tab === 'users' && <UsersTab users={users} setUsers={setUsers} sessions={sessions} now={now} onlineIds={onlineIds} meId={me?.uid} />}
      {tab === 'prodimg' && <ProductImagesTab />}
      {tab === 'reviews' && <ReviewsTab />}
      {tab === 'contact' && <SettingsTab />}
      {tab === 'areas' && <AreasTab sessions={sessions} orders={orders} users={users} phs={phs} now={now} />}
      {tab === 'pharmacies' && <PharmaciesTab phs={phs} setPhs={setPhs} users={users} />}
      {tab === 'products' && <ProductsTab phs={phs} />}
      {tab === 'banners' && <BannersTab />}
      {tab === 'orders' && <OrdersTab orders={orders} now={now} />}
      {tab === 'rx' && <RxTab now={now} />}
      {tab === 'system' && <SystemTab sessions={sessions} now={now} />}
    </div>
  );
}
