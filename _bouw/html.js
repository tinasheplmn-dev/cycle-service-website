/* Kleine HTML-lezer zonder dependencies, voor de eigen (nette) HTML van deze site.
   Gebruikt door de bouwstap (annoteren) en de server (teksten en foto's uit het beheer invullen).
   Geeft een boom met offsets terug, zodat we gericht in de originele tekst kunnen vervangen
   zonder de opmaak van het bestand te veranderen. */
'use strict';

const LEEG = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const RAUW = new Set(['script', 'style', 'textarea', 'title']);

function attributen(tekst) {
  const a = {};
  const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m;
  while ((m = re.exec(tekst))) a[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
  return a;
}

/* node: { tag, attrs, start, openEnd, closeStart, end, children, parent } of { text, start, end } */
function lees(html) {
  const wortel = { tag: '#wortel', attrs: {}, start: 0, openEnd: 0, closeStart: html.length, end: html.length, children: [], parent: null };
  let huidig = wortel;
  let i = 0;
  const n = html.length;
  while (i < n) {
    const lt = html.indexOf('<', i);
    if (lt === -1 || lt > i) {
      const eind = lt === -1 ? n : lt;
      huidig.children.push({ text: html.slice(i, eind), start: i, end: eind, parent: huidig });
      i = eind;
      continue;
    }
    if (html.startsWith('<!--', i)) {
      const e = html.indexOf('-->', i + 4);
      const eind = e === -1 ? n : e + 3;
      huidig.children.push({ comment: html.slice(i + 4, eind - 3), start: i, end: eind, parent: huidig });
      i = eind;
      continue;
    }
    if (html[i + 1] === '!' || html[i + 1] === '?') { const e = html.indexOf('>', i); i = e === -1 ? n : e + 1; continue; }
    if (html[i + 1] === '/') {
      const e = html.indexOf('>', i);
      if (e === -1) { huidig.children.push({ text: html.slice(i), start: i, end: n, parent: huidig }); i = n; continue; }
      const naam = html.slice(i + 2, e).trim().toLowerCase();
      let s = huidig;
      while (s && s.tag !== naam) s = s.parent;
      if (s && s !== wortel) {
        while (huidig !== s) { huidig.closeStart = i; huidig.end = i; huidig = huidig.parent; }
        s.closeStart = i; s.end = e + 1; huidig = s.parent;
      }
      i = e + 1;
      continue;
    }
    const m = /^<([a-zA-Z][a-zA-Z0-9-]*)/.exec(html.slice(i, i + 40));
    if (!m) { huidig.children.push({ text: '<', start: i, end: i + 1, parent: huidig }); i++; continue; }
    /* einde van de openingstag, met aanhalingstekens in attributen */
    let j = i + m[0].length, q = null;
    while (j < n) {
      const c = html[j];
      if (q) { if (c === q) q = null; }
      else if (c === '"' || c === "'") q = c;
      else if (c === '>') break;
      j++;
    }
    if (j >= n) { huidig.children.push({ text: html.slice(i), start: i, end: n, parent: huidig }); break; }
    const tag = m[1].toLowerCase();
    const binnen = html.slice(i + m[0].length, j);
    const zelf = /\/\s*$/.test(binnen);
    const node = { tag, attrs: attributen(binnen.replace(/\/\s*$/, '')), start: i, openEnd: j + 1, closeStart: j + 1, end: j + 1, children: [], parent: huidig };
    huidig.children.push(node);
    i = j + 1;
    if (LEEG.has(tag) || zelf) continue;
    if (RAUW.has(tag)) {
      /* zoeken zonder toLowerCase: sommige tekens (zoals İ) worden dan langer en de posities verschuiven */
      const re = new RegExp('</' + tag, 'ig');
      re.lastIndex = i;
      const mm = re.exec(html);
      const e = mm ? mm.index : -1;
      const eind = e === -1 ? n : e;
      if (eind > i) node.children.push({ text: html.slice(i, eind), start: i, end: eind, parent: node });
      node.closeStart = eind;
      const gt = e === -1 ? -1 : html.indexOf('>', e);
      node.end = gt === -1 ? n : gt + 1;
      i = node.end;
      continue;
    }
    huidig = node;
  }
  return wortel;
}

function* alle(node) {
  for (const k of node.children || []) { yield k; if (k.tag) yield* alle(k); }
}
const elementen = (wortel) => [...alle(wortel)].filter((k) => k.tag);
const tekstVan = (node) => (node.text != null ? node.text : (node.children || []).map(tekstVan).join(''));

/* vervangingen [{ start, end, tekst }] in één keer toepassen, van achter naar voren */
function vervang(html, lijst) {
  const v = lijst.slice().sort((a, b) => b.start - a.start);
  let uit = html, grens = Infinity;
  for (const x of v) {
    if (x.end > grens) continue;   /* overlap: de vervanging die later in de tekst begint wint, de andere vervalt */
    uit = uit.slice(0, x.start) + x.tekst + uit.slice(x.end);
    grens = x.start;
  }
  return uit;
}

/* ---------- veilig HTML voor teksten uit het beheer ----------
   Alleen opmaak binnen een regel blijft over; al het andere wordt tekst. */
const TOEGESTAAN = {
  strong: [], b: [], em: [], i: [], mark: [], small: [], sup: [], sub: [], br: [], u: [],
  span: ['class', 'data-dienst'],
  a: ['href', 'target', 'rel'],
};
const KLASSEN = new Set(['regel', 'licht', 'nadruk', 'onder']);
const ENTITEIT = /^&(?:[a-zA-Z][a-zA-Z0-9]{1,31}|#[0-9]{1,7}|#x[0-9a-fA-F]{1,6});/;
function tekstVeilig(t) {
  let uit = '';
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c === '&') { const m = ENTITEIT.exec(t.slice(i)); if (m) { uit += m[0]; i += m[0].length - 1; } else uit += '&amp;'; }
    else if (c === '<') uit += '&lt;';
    else if (c === '>') uit += '&gt;';
    else if (c === '\u0000') continue;
    else uit += c;
  }
  return uit;
}
const attrVeilig = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/* witruimte en stuurtekens eruit: browsers negeren die, zodat java<tab>script: anders langs de controle glipt */
const schoneLink = (href) => String(href).replace(/[\u0000-\u0020\u007f-\u009f]/g, '');
function linkOk(href) {
  const h = schoneLink(href);
  if (/^(https?:|mailto:|tel:)/i.test(h)) return true;
  if (/^[a-z][a-z0-9+.-]*:/i.test(h)) return false;          /* javascript:, data:, enzovoort */
  return /^[#./a-zA-Z0-9_-]/.test(h) && !h.startsWith('//');
}
function veiligeHtml(invoer, max = 5000) {
  const s = String(invoer || '').slice(0, max);
  const stapel = [];
  let uit = '';
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*)>|<!--[\s\S]*?-->/g;
  let pos = 0, m;
  while ((m = re.exec(s))) {
    uit += tekstVeilig(s.slice(pos, m.index));
    pos = re.lastIndex;
    if (!m[2]) continue;                                       /* commentaar weg */
    const tag = m[2].toLowerCase();
    if (!TOEGESTAAN[tag]) continue;
    if (m[1]) {
      const plek = stapel.lastIndexOf(tag);
      if (plek === -1) continue;
      while (stapel.length > plek) uit += '</' + stapel.pop() + '>';
      continue;
    }
    const a = attributen(m[3]);
    let attr = '';
    for (const naam of TOEGESTAAN[tag]) {
      if (a[naam] == null) continue;
      let w = a[naam];
      if (naam === 'class') { w = w.split(/\s+/).filter((k) => KLASSEN.has(k)).join(' '); if (!w) continue; }
      if (naam === 'href') { if (!linkOk(w)) continue; w = schoneLink(w); }
      if (naam === 'target' && w !== '_blank') continue;
      if (naam === 'data-dienst' && !/^[a-z]+$/.test(w)) continue;
      attr += ` ${naam}="${attrVeilig(w)}"`;
    }
    if (tag === 'a' && a.target === '_blank') attr = attr.replace(/ rel="[^"]*"/, '') + ' rel="noopener"';
    if (tag === 'br') { uit += '<br>'; continue; }
    uit += `<${tag}${attr}>`;
    stapel.push(tag);
  }
  uit += tekstVeilig(s.slice(pos));
  while (stapel.length) uit += '</' + stapel.pop() + '>';
  return uit;
}

module.exports = { lees, alle, elementen, tekstVan, vervang, veiligeHtml, attrVeilig, attributen, LEEG };
