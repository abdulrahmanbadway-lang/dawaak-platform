import { useState } from 'react';
import { Icon } from './icons.jsx';
import { toast } from './ui.jsx';
import { trs } from './lib/i18n.js';
import { docImage } from './lib/img.js';

// المستندات الرسمية المطلوبة من الصيدلية
export const DOC_KINDS = [['commercial', 'ارفع صورة سجل تجاري'], ['tax', 'ارفع صورة بطاقة ضريبية'], ['license', 'ارفع رخصة الصيدلية']];

export function DocBox({ label, value, onChange, disabled }) {
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const file = e.target.files && e.target.files[0]; e.target.value = ''; if (!file) return;
    setBusy(true);
    try { onChange(await docImage(file)); } catch (x) { toast(x.message); }
    setBusy(false);
  };
  return (
    <div className="docbox">
      <label className="dl">{trs(label)}</label>
      <label className={'dz' + (value ? ' has' : '') + (disabled ? ' off' : '')}>
        <input type="file" accept="image/*" onChange={pick} disabled={disabled || busy} hidden />
        {value ? <img src={value} alt={trs(label)} /> : <><Icon n="camera" s={26} /><b>{busy ? '…' : trs("اضغط لاختيار صورة")}</b></>}
        {value && !disabled && <span className="chg">{busy ? '…' : trs("تغيير الصورة")}</span>}
      </label>
    </div>
  );
}

export function DocsFields({ docs, setDocs, disabled }) {
  return <div className="docs">{DOC_KINDS.map(([k, l]) => <DocBox key={k} label={l} value={docs[k] || ''} disabled={disabled} onChange={(v) => setDocs((d) => ({ ...d, [k]: v }))} />)}</div>;
}
