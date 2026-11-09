import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase.js';
import { ms } from './status.js';

const t = (o) => ms(o.createdAt) || Date.now();
// متابعة لحظية للروشتات (field = patientId أو pharmacyId)
export function useRx(field, uid) {
  const [rows, setRows] = useState(null), [err, setErr] = useState('');
  useEffect(() => onSnapshot(query(collection(db, 'prescriptions'), where(field, '==', uid)),
    (s) => setRows(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => t(b) - t(a))),
    (e) => setErr(e.message)), [field, uid]);
  return { rows, err };
}
