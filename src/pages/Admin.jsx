import { useCallback, useEffect, useMemo, useState } from 'react';
import { collection, getCountFromServer, getDocs, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase.js';
import { useAuth } from '../auth.jsx';
import { Icon } from '../icons.jsx';
import { ConfirmHost, ON_MS, RECENT_MS, Seg, ms, useNow } from './admin/common.jsx';
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
import { errMsg } from '../lib/errors.js';

function useData() {
  const [pres, setPres] = useState(null), [orders, setOrders] = useState(null), [users, setUsers] = useState(null), [phs, setPhs] = useState(null), [err, setErr] = useState(''), [rxNew, setRxNew] = useState(null), [rxLast, setRxLast] = useState(null);
  const loadStatic = useCallback(async () => {
    try {
      const [u, p] = await Promise.all([getDocs(collection(db, 'users')), getDocs(collection(db, 'pharmacies'))]);
      setUsers(u.docs.map((d) => ({ id: d.id, ...d.data() }))); setPhs(p.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) { setErr(errMsg(e)); }
    // أرقام ثانوية: لو فشلت مش بتوقف اللوحة (عدّاد الروشتات المعلّقة + آخر 5 روشتات للنظرة العامة)
    getCountFromServer(query(collection(db, 'prescriptions'), where('status', '==', 'pending'))).then((c) => setRxNew(c.data().count)).catch(() => setRxNew(null));
    getDocs(query(collection(db, 'prescriptions'), orderBy('createdAt', 'desc'), limit(5))).then((s) => setRxLast(s.docs.map((d) => { const { images, ...r } = d.data(); return { id: d.id, ...r, nImages: Array.isArray(images) ? images.length : 0 }; }))).catch(() => setRxLast([]));
  }, []);
  useEffect(() => {
    loadStatic();
    const bad = (e) => setErr(errMsg(e));
    const a = onSnapshot(query(collection(db, 'presence'), orderBy('lastSeen', 'desc'), limit(300)), (s) => setPres(s.docs.map((d) => ({ id: d.id, ...d.data() }))), bad);
    const b = onSnapshot(query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(200)), (s) => setOrders(s.docs.map((d) => ({ id: d.id, ...d.data() }))), bad);
    return () => { a(); b(); };
  }, [loadStatic]);
  return { pres, orders, users, phs, err, rxNew, rxLast, reload: loadStatic, setPhs, setUsers, setRxNew };
}

const TABS = [['overview', 'نظرة عامة', 'home'], ['live', 'مباشر', 'bolt'], ['orders', 'الطلبات', 'bag'], ['rx', 'الروشتات', 'rx'], ['pharmacies', 'الصيدليات', 'store'], ['users', 'المستخدمون', 'users'], ['products', 'المنتجات', 'pill'], ['content', 'المحتوى', 'star'], ['areas', 'المناطق', 'pin'], ['system', 'النظام', 'shield']];
// المحتوى: الإعلانات + صور المنتجات + الآراء + بيانات التواصل
const CONTENT = [['banners', 'الإعلانات'], ['prodimg', 'صور المنتجات'], ['reviews', 'الآراء'], ['contact', 'التواصل']];

export default function Admin() {
  const [tab, setTab] = useState(() => { try { const t = sessionStorage.getItem('dw_adm_tab'); return TABS.some((x) => x[0] === t) ? t : 'overview'; } catch { return 'overview'; } });
  const [sub, setSub] = useState('banners');
  const { user: me } = useAuth();
  const { pres, orders, users, phs, err, rxNew, rxLast, reload, setPhs, setUsers, setRxNew } = useData();
  const now = useNow(15000);
  const go = useCallback((t) => { setTab(t); try { sessionStorage.setItem('dw_adm_tab', t); } catch { /* التخزين غير متاح */ } window.scrollTo({ top: 0 }); }, []);
  const uById = useMemo(() => Object.fromEntries((users || []).map((u) => [u.id, u])), [users]);
  const sessions = useMemo(() => (pres || []).map((r) => { const u = r.uid ? uById[r.uid] : null; return { ...r, u, t: ms(r.lastSeen) ?? now, name: u?.name || (r.uid ? 'مستخدم' : 'زائر'), role: u?.role || null }; }).sort((a, b) => b.t - a.t), [pres, uById, now]);
  const online = sessions.filter((s) => now - s.t <= ON_MS);
  const recent = sessions.filter((s) => now - s.t > ON_MS && now - s.t <= RECENT_MS);
  const onlineIds = useMemo(() => new Set(online.filter((s) => s.uid).map((s) => s.uid)), [online]);
  // بدجات التبويبات = شغل محتاج انتباه الأدمن
  const newOrders = (orders || []).filter((o) => o.status === 'new').length;
  const pendPh = (phs || []).filter((p) => !p.verified).length;
  const badge = { live: [online.length, 'gr'], orders: [newOrders, 'am'], rx: [rxNew || 0, 'am'], pharmacies: [pendPh, 'am'] };

  if (err) return (
    <div className="card center"><h2>مش قادر أحمّل البيانات</h2>
      <p className="mu">{/permission|صلاحية/i.test(err) ? 'الحساب ده مش أدمن، أو قواعد Firestore الجديدة لسه ما اتنشرتش (firebase deploy --only firestore:rules).' : err}</p>
      <button className="btn o sm" onClick={() => { location.reload(); }}>إعادة تحميل</button></div>
  );
  return (
    <div className="adm">
      <ConfirmHost />
      <div className="row between wrap g adm-hd">
        <div><h1>لوحة التحكم</h1><p className="mu sm2">الطلبات والحضور مباشرين · الحسابات والصيدليات بتتحدث بزر التحديث</p></div>
        <div className="row g"><span className="adm-live"><i />مباشر</span><button className="btn o sm" onClick={reload}>تحديث</button></div>
      </div>
      <div className="adm-tabs" role="tablist">{TABS.map(([k, l, ic]) => { const b = badge[k]; return <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => go(k)}><Icon n={ic} s={16} />{l}{b && b[0] > 0 && <b className={b[1]}>{b[0]}</b>}</button>; })}</div>
      {tab === 'overview' && <OverviewTab sessions={sessions} online={online} users={users} phs={phs} orders={orders} rxNew={rxNew} rxLast={rxLast} now={now} go={go} />}
      {tab === 'live' && <LiveTab sessions={sessions} online={online} recent={recent} now={now} />}
      {tab === 'users' && <UsersTab users={users} setUsers={setUsers} sessions={sessions} now={now} onlineIds={onlineIds} meId={me?.uid} />}
      {tab === 'content' && (
        <>
          <div className="adm-bar"><Seg v={sub} on={setSub} opts={CONTENT.map(([k, l]) => [k, l])} /></div>
          {sub === 'banners' && <BannersTab />}
          {sub === 'prodimg' && <ProductImagesTab />}
          {sub === 'reviews' && <ReviewsTab />}
          {sub === 'contact' && <SettingsTab />}
        </>
      )}
      {tab === 'areas' && <AreasTab sessions={sessions} orders={orders} users={users} phs={phs} now={now} />}
      {tab === 'pharmacies' && <PharmaciesTab phs={phs} setPhs={setPhs} users={users} orders={orders} />}
      {tab === 'products' && <ProductsTab phs={phs} />}
      {tab === 'orders' && <OrdersTab orders={orders} now={now} />}
      {tab === 'rx' && <RxTab now={now} setRxNew={setRxNew} />}
      {tab === 'system' && <SystemTab sessions={sessions} now={now} />}
    </div>
  );
}
