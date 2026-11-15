import { useState } from 'react';
import { Badge } from '../../ui.jsx';
import { Icon } from '../../icons.jsx';
import { Dot, Empty, ROLE, ago, pageName } from './common.jsx';

export default function Live({ sessions, online, recent, now }) {
  const [f, setF] = useState('all');
  const show = (l) => l.filter((s) => (f === 'all' ? true : f === 'm' ? s.uid : !s.uid));
  const row = (s, on) => (
    <li key={s.id} className="adm-s">
      <Dot on={on} />
      <span className="adm-av">{(s.name || '?')[0]}</span>
      <div className="adm-sm"><b>{s.name}</b> {s.role && <Badge c={s.role === 'admin' ? 'am' : ''}>{ROLE[s.role] || s.role}</Badge>}
        <div className="mu sm2">{s.mobile ? 'موبايل' : 'كمبيوتر'}{s.dev ? ' · ' + s.dev : ''}</div></div>
      <div className="adm-sp"><span className="adm-chip"><Icon n="pin" s={13} />{pageName(s.path)}</span></div>
      <div className="adm-si">{s.ip ? <span dir="ltr"><b>{s.ip}</b>{s.cc ? <small> · {s.cc}</small> : null}</span> : <span className="mu">IP غير متاح</span>}</div>
      <div className="adm-st mu sm2">{ago(s.t, now)}</div>
    </li>
  );
  const nOn = show(online), nRec = show(recent);
  return (
    <>
      <div className="row between wrap g adm-bar">
        <h3>على الموقع دلوقتي ({online.length})</h3>
        <div className="adm-seg">{[['all', 'الكل'], ['m', 'مسجّلين'], ['v', 'زوار']].map(([k, l]) => <button key={k} className={f === k ? 'on' : ''} onClick={() => setF(k)}>{l}</button>)}</div>
      </div>
      <div className="adm-chips"><span>موبايل: <b>{online.filter((s) => s.mobile).length}</b></span><span>كمبيوتر: <b>{online.filter((s) => !s.mobile).length}</b></span><span>الإجمالي المسجّل: <b>{sessions.length}</b></span></div>
      <div className="card adm-list">{nOn.length ? <ul>{nOn.map((s) => row(s, true))}</ul> : <Empty>مفيش حد على الموقع دلوقتي</Empty>}</div>
      <h3 className="mt">كانوا نشطين (آخر 15 دقيقة)</h3>
      <div className="card adm-list">{nRec.length ? <ul>{nRec.map((s) => row(s, false))}</ul> : <Empty>مفيش</Empty>}</div>
      <p className="mu sm2">المتصل = آخر نبضة خلال دقيقتين. النبضة بتتبعت كل دقيقة والتبويب ظاهر وعند تغيير الصفحة. عنوان الـ IP بيتجاب من المتصفح (مش مضمون).</p>
    </>
  );
}
