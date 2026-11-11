import { trs } from './lib/i18n.js';
export function toast(m) {
  const d = document.createElement('div');
  d.className = 'toast'; d.textContent = m;
  document.body.append(d); setTimeout(() => d.remove(), 3000);
}
export const Badge = ({ c = '', children }) => <span className={'bd ' + c}>{children}</span>;

export function Field({ label, name, v, on, type = 'text', options = [], hint, ...rest }) {
  const id = 'f_' + name;
  if (type === 'checkbox')
    return <label className="ck"><input type="checkbox" name={name} checked={!!v} onChange={(e) => on(e.target.checked)} /> {label}</label>;
  let el;
  if (type === 'select')
    el = <select id={id} name={name} value={v} onChange={(e) => on(e.target.value)} className="fi" {...rest}><option value="">{trs("اختر…")}</option>{options.map((o) => <option key={o} value={o}>{trs(o)}</option>)}</select>;
  else if (type === 'textarea')
    el = <textarea id={id} name={name} value={v} onChange={(e) => on(e.target.value)} className="fi" rows="3" {...rest} />;
  else
    el = <input id={id} name={name} type={type} value={v} onChange={(e) => on(e.target.value)} className="fi" {...rest} />;
  return <div className="fd"><label htmlFor={id}>{label}</label>{el}{hint && <small>{hint}</small>}</div>;
}
