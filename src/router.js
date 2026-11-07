import { useEffect, useState } from 'react';

export const go = (p) => { location.hash = '#' + p; };
const read = () => {
  const [path, qs = ''] = (location.hash.slice(1) || '/').split('?');
  return { path, q: new URLSearchParams(qs) };
};
export function useRoute() {
  const [r, setR] = useState(read);
  useEffect(() => {
    const f = () => { setR(read()); scrollTo(0, 0); };
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  return r;
}
