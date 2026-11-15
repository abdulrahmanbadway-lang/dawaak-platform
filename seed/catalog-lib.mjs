// كتالوج الأدوية والمنتجات (1000 صنف) من seed/data/products-1000.json: تصنيف تلقائي لقسم رئيسي وفرعي، واستخراج الجرعة والشكل، وتوزيعه على الصيدليات الموثّقة.
// مهم: الملف مفيهوش صور (الروابط اللي فيه placehold.co مجرد نصوص بديلة، فبتتجاهل). الصور الحقيقية بتترفع من لوحة التحكم > صور المنتجات.
// مفيهوش علامة "يحتاج روشتة"، فالعلامة دي بتتحدد تقريبياً من الفئة الدوائية (راجعها). الأسعار والتوفر من الملف زي ما هي (السعر بيتفاوت ±6% بين الصيدليات).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PHARMACIES, norm } from './lib.mjs';

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'products-1000.json');
export const hasCatalog = () => fs.existsSync(FILE);
export const catId = (id, pi) => `cat-${id}-${pi + 1}`;

const rng = (seed) => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
const title = (s) => s.toLowerCase().replace(/(^|[\s.&(\-/])([a-z])/g, (_, a, b) => a + b.toUpperCase());
const T = (re, s) => re.test(s);

const FORMS = [[/EFF/i, 'أقراص فوّارة'], [/LOZENG/i, 'أقراص مص'], [/\bTAB|CAPLET|F\.?C/i, 'قرص'], [/\bCAP/i, 'كبسولة'], [/SYRUP|\bSYR\b|SUSP|ELIXIR/i, 'شراب'],
  [/SHAMPOO/i, 'شامبو'], [/CREAM/i, 'كريم'], [/\bGEL\b/i, 'جل'], [/OINT/i, 'مرهم'], [/DROP/i, 'نقط'], [/SPRAY/i, 'بخاخ'], [/LOTION/i, 'لوشن'], [/SACHET/i, 'أكياس'],
  [/\bINJ|AMP|VIAL/i, 'حقن'], [/SUPP/i, 'لبوس'], [/SOLN|SOLUTION|MOUTH ?WASH/i, 'محلول'], [/POWDER/i, 'بودرة'], [/SOAP/i, 'صابون'], [/\bOIL\b/i, 'زيت'], [/\bMASK\b/i, 'ماسك']];
const formOf = (en) => (FORMS.find(([re]) => re.test(en)) || [0, ''])[1];
const doseOf = (en) => (en.match(/\d+(?:\.\d+)?\s?(?:MG|MCG|GM|G|ML|IU|%)(?:\s?\/\s?\d+(?:\.\d+)?\s?(?:ML|MG|GM|G))?/i) || [''])[0].replace(/\s+/g, ' ').trim();

const DRUG = /ANTIBIOTIC|QUINOLONE|PENICILLIN|MACROLIDE|CEPHALO|ANTI-?HYPERTENS|DIURETIC|ANTI-?VIRAL|BRONCHODILATOR|BISPHOSPHONATE|ANDROGEN|ANTI-?MUSCARINIC|ANTI-?COUGH|NASAL DECONGESTANT|ANTI-?DIARRH|ANTISPASMODIC|ANTI-?INFLAMMATORY|PSORIASIS|ANTIFUNGAL|URINARY|KERATOLYTIC|HAEMORRHOID|ANTI-?DIABET|ANTIHYPERLIP|PSYCHIATRIC|EPILEPT|ANTIPLATL|ESTROGEN|DOPAMINE|WAKEFULNESS|SLEEP AID|ANTIPROTOZOAL|SEXUAL TONIC|PEPTIC|ANTACID|DIGESTIVE ENZYME|ANTI-?FLATULENT|ANTI-?HISTAMINE|ANTI-?LICE|HEAD LICE/i;
const RX = /ANTIBIOTIC|QUINOLONE|PENICILLIN|MACROLIDE|CEPHALO|HYPERTENS|DIURETIC|VIRAL|BISPHOSPHONATE|ANDROGEN|MUSCARINIC.*ASTHMA|ANTI-?DIABET|HYPERLIP|PSYCHIATRIC|EPILEPT|PLATL|ESTROGEN|DOPAMINE|WAKEFULNESS|PROTOZOAL|SEXUAL TONIC|BRONCHODILATOR|URINARY|PSORIASIS|BLOCKER|STATIN/i;

function classify(x) {
  const dc = (x.drug_class || '').toUpperCase(), en = x.name_en.toUpperCase(), route = x.route || '';
  let cat = x.category, sub = '';
  if (T(/ORAL CARE|TOOTH|MOUTHWASH|ORAL SPRAY/, dc) || T(/TOOTH ?PASTE|MOUTH ?WASH/, en)) return ['الاحتياجات اليومية', 'العناية بالفم والأسنان'];
  if (T(/LUBRICANT/, dc)) return ['الصحة الجنسية', 'مزلقات'];
  if (T(/HEAD LICE|ANTI-?LICE/, dc)) return ['العناية بالشعر', 'علاج الشعر'];
  if (T(/MASSAGE/, dc)) return ['المستلزمات الطبية', 'تسكين الألم'];
  if (T(/DIAPER RASH/, dc)) return ['الأم والطفل', 'استحمام الطفل'];
  if (cat !== 'الأدوية' && DRUG.test(dc) && cat !== 'الصحة الجنسية' && !(cat === 'الأم والطفل' && !T(/ANTIBIOTIC|PENICILLIN|ANTI-?MUSCARINIC|ANTIDIARRH/, dc))) cat = 'الأدوية';
  switch (cat) {
    case 'الأدوية':
      if (T(/ANTIBIOTIC|QUINOLONE|PENICILLIN|MACROLIDE|CEPHALO|PROTOZOAL/, dc)) sub = 'مضادات حيوية';
      else if (T(/HISTAMINE|ALLERGY/, dc)) sub = 'حساسية';
      else if (T(/COLD|SORE THROAT|COUGH|DECONGESTANT/, dc)) sub = 'برد وكحة';
      else if (T(/ANALGESIC|ANTIPYRETIC|NSAID/, dc)) sub = 'مسكنات وخافضات حرارة';
      else if (T(/PEPTIC|ULCER|ANTACID|DIARRH|MUSCARINIC|DIGESTIVE|FLATULENT|SPASMODIC|GIT|LAXATIVE/, dc)) sub = 'معدة وهضم';
      else if (route === 'EYE' || route === 'EAR') sub = 'عيون وأذن';
      else if (route === 'TOPICAL' || T(/HAEMORRHOID|PSORIASIS|KERATOLYTIC|ANTIFUNGAL/, dc)) sub = 'أدوية جلدية';
      else if (T(/HYPERTENS|DIURETIC|DIABET|HYPERLIP|STATIN|EPILEPT|PSYCHIATRIC|PLATL|BLOCKER|DOPAMINE|BISPHOSPHONATE|ANDROGEN|ESTROGEN|URINARY/, dc)) sub = 'أمراض مزمنة';
      break;
    case 'الفيتامينات والمكملات':
      sub = T(/OMEGA|DIETARY|DIETRY|FOOD|ANTIOXIDANT|BRAIN|BIOTIN|SUPPORT/, dc) ? 'مكملات غذائية' : 'فيتامينات ومعادن';
      break;
    case 'العناية بالبشرة':
      sub = T(/SUN ?BLOCK|SUB BLOCK/, dc) ? 'واقي شمس' : T(/EYE/, dc) ? 'العناية بالعين' : T(/CLEANS|ACNE/, dc) ? 'غسول ومنظفات' : T(/WHITEN|FIRMING|SCAR|SERUM/, dc) ? 'سيروم' : 'مرطبات';
      break;
    case 'العناية بالشعر':
      sub = T(/SHAMPOO|CONDITIONER/, dc + ' ' + en) ? 'شامبو وبلسم' : T(/DYE|COLOR/, en) ? 'صبغات الشعر' : 'علاج الشعر';
      break;
    case 'الأم والطفل':
      sub = T(/MILK/, dc + ' ' + en) ? 'أغذية الأطفال' : T(/DIAPER/, en) ? 'حفاضات' : '';
      break;
    default: break;
  }
  return [cat, sub];
}

// بيرجّع مستندات products (path + data) للكتالوج كله موزّعة على الصيدليات الموثّقة. uid(key) -> uid الصيدلية.
export function catalogDocs(uid) {
  const L = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const ph = PHARMACIES.map((p, i) => ({ p, i })).filter((x) => x.p.v);
  const dup = {}; L.forEach((x) => { dup[x.name_ar] = (dup[x.name_ar] || 0) + 1; });
  const docs = [], now = Date.now();
  L.forEach((x, n) => {
    const [category, sub] = classify(x), en = x.name_en.trim(), dose = doseOf(en), form = formOf(en);
    const spec = en.replace(/^\S+\s*/, '').trim();
    const name = dup[x.name_ar] > 1 && spec ? `${x.name_ar} (${spec})` : x.name_ar;
    const ing = title((x.active_ingredient || '').replace(/\s+/g, ' ').trim()).slice(0, 120);
    const brand = title(((x.manufacturer || '').split('>')[0] || '').replace(/\s+/g, ' ').trim()).slice(0, 60);
    const rx = category === 'الأدوية' || category === 'الصحة الجنسية' ? RX.test(x.drug_class || '') : false;
    const r = rng(7000 + x.id * 13);
    const copies = x.id % 10 === 0 ? 3 : 1;           // كل عاشر صنف عند 3 صيدليات (عشان المقارنة بين الأسعار)، الباقي عند صيدلية واحدة
    for (let c = 0; c < copies; c++) {
      const h = ph[(n + c) % ph.length], r1 = r(), r2 = r();
      const price = Math.max(1, Math.round(x.price_egp * (c ? 0.94 + r1 * 0.12 : 1) * 100) / 100);
      const stock = x.in_stock === false || r2 < 0.06 ? 0 : 6 + Math.floor(r() * 55);
      docs.push({ path: `products/${catId(x.id, h.i)}`, data: {
        pharmacyId: uid('ph' + (h.i + 1)), name, nameLower: norm(name), nameEn: title(en).slice(0, 120), ingredient: ing, ingredientLower: norm(ing),
        dose, form, price, stock, rx, category, sub, brand, drugClass: (x.drug_class || '').slice(0, 80), route: x.route || '',
        description: '', warnings: rx ? 'دواء يُصرف بروشتة طبية. استشر الطبيب أو الصيدلي قبل الاستخدام.' : '', imageUrl: '', imgReal: false,
        createdAt: new Date(now - (1 + (n % 20)) * 864e5), seed: true } });
    }
  });
  return docs;
}
export const catalogStats = (docs) => {
  const by = {}; docs.forEach((d) => { const k = d.data.category + ' / ' + (d.data.sub || '—'); by[k] = (by[k] || 0) + 1; });
  return by;
};
