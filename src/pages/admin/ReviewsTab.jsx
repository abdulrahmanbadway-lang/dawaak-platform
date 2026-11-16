import { useCallback, useEffect, useState } from 'react';
import { collection, deleteDoc, doc, getDocs, limit, query } from 'firebase/firestore';
import { db } from '../../firebase.js';
import { toast } from '../../ui.jsx';
import { errMsg } from '../../lib/errors.js';

export default function ReviewsAdmin() {
  const [rows, setRows] = useState(null);
  const load = useCallback(() => getDocs(query(collection(db, 'reviews'), limit(100))).then((s) => setRows(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)))).catch((e) => { toast('تعذر التحميل: ' + errMsg(e)); setRows([]); }), []);
  useEffect(() => { load(); }, [load]);
  const del = async (r) => { if (!confirm('تحذف رأي ' + r.name + '؟')) return; try { await deleteDoc(doc(db, 'reviews', r.id)); await load(); } catch (x) { toast(errMsg(x)); } };
  if (!rows) return <p className="mu">جاري التحميل…</p>;
  const avg = rows.length ? (rows.reduce((s, r) => s + (r.rating || 0), 0) / rows.length).toFixed(1) : '—';
  return (
    <div className="adm-card">
      <h3>آراء العملاء ({rows.length}) · المتوسط {avg}/5</h3>
      <table className="adm-t"><thead><tr><th>الاسم</th><th>التقييم</th><th>الرأي</th><th></th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.id}><td><b>{r.name}</b></td><td>{'★'.repeat(r.rating || 0)}</td><td>{r.text}</td><td><button className="btn o sm" onClick={() => del(r)}>حذف</button></td></tr>)}
          {!rows.length && <tr><td colSpan="4" className="mu">لسه مفيش آراء.</td></tr>}</tbody></table>
    </div>
  );
}
