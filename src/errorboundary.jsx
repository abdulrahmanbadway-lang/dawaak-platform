import { Component } from 'react';
import { trs } from './lib/i18n.js';

// بيمسك أي خطأ في رسم الصفحة بدل ما الشاشة تبقى بيضا. full = شاشة كاملة (على مستوى التطبيق)، غير كده مكان الصفحة بس (الهيدر يفضل شغال).
// resetKey: لما يتغيّر (مثلاً المسار) الخطأ بيتمسح وبيجرّب يرسم تاني.
export default class ErrorBoundary extends Component {
  constructor(p) { super(p); this.state = { err: null, key: p.resetKey }; }
  static getDerivedStateFromError(err) { return { err }; }
  static getDerivedStateFromProps(p, s) { return p.resetKey !== s.key ? { err: null, key: p.resetKey } : null; }
  componentDidCatch(err, info) { console.error('[dawaak] render error:', err, info?.componentStack); }
  render() {
    if (!this.state.err) return this.props.children;
    const full = this.props.full;
    const box = (
      <div className="card center eb" role="alert" style={{ maxWidth: 520, margin: full ? '12vh auto 0' : '20px auto' }}>
        <h2>{trs("حصلت مشكلة غير متوقعة")}</h2>
        <p className="mu">{trs("الصفحة دي مفتحتش صح. جرّب تعيد التحميل، ولو المشكلة استمرت ارجع للرئيسية.")}</p>
        <div className="row g wrap" style={{ justifyContent: 'center' }}>
          <button className="btn" onClick={() => location.reload()}>{trs("إعادة تحميل")}</button>
          <a className="btn o" href="#/" onClick={() => this.setState({ err: null })}>{trs("الرئيسية")}</a>
        </div>
        {import.meta.env.DEV && <pre dir="ltr" className="mu sm2" style={{ textAlign: 'left', whiteSpace: 'pre-wrap' }}>{String(this.state.err?.message || this.state.err)}</pre>}
      </div>
    );
    return full ? <div className="w">{box}</div> : box;
  }
}
