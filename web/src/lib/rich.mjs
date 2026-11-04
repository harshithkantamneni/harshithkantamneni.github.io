// Turns the small markup used in site copy into HTML, and fails the build on a number with no claim.
//   [[claim.id|shown text]]  a number linked to its conditions
//   [[claim.id]]             the word "conditions" linked to that claim
//   {{bar:0.96/1}}           a CSS bar plus its printed value, so width and text can't disagree
import data from '../../../data/claims.json';

export const claims = data.claims;
export const asOf = data.as_of;
const byId = new Map(claims.map((c) => [c.id, c]));

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Facts that aren't measurements stay plain text
const PLAIN = new Set(['profile.degree', 'cert.cuda', 'cert.llm', 'gem5.team', 'ml.team', 'lab.memory', 'count.roles']);

function link(id, text) {
  const c = byId.get(id);
  if (!c) throw new Error(`Unknown claim: ${id}`);
  if (text && !c.shows.some((s) => text.includes(s) || s.includes(text))) {
    throw new Error(`"${text}" is not in the shown values of ${id}: ${c.shows.join(' | ')}`);
  }
  if (PLAIN.has(id) && text) return text;
  return `<a class="n" href="/numbers/#${id}" data-m="${esc(c.means)}" data-c="${esc(c.conditions)}">${text || 'conditions'}</a>`;
}

export function rich(s) {
  return s
    .replace(/\[\[([\w.-]+)\|([^\]]+)\]\]/g, (_, id, text) => link(id, text))
    .replace(/\[\[([\w.-]+)\]\]/g, (_, id) => link(id))
    .replace(/\{\{bar:([\d.]+)\/([\d.]+)\}\}/g, (_, v, max) => {
      const pct = Math.min(100, (parseFloat(v) / parseFloat(max)) * 100).toFixed(1);
      return `<span class="barv"><span class="bt"><i style="width:${pct}%"></i></span><span class="v">${v}</span></span>`;
    });
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fmtDate(iso, withYear = true) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}${withYear ? `, ${y}` : ''}`;
}

const day = (iso) => Date.parse(iso) / 864e5;
const START = '2026-01-01';
export const pct = (iso, end) => ((day(iso) - day(START)) / (day(end) - day(START))) * 100;
export function monthTicks(end) {
  const out = [];
  for (let m = 1; m <= 12; m++) {
    const iso = `2026-${String(m).padStart(2, '0')}-01`;
    if (day(iso) < day(end) - 15) out.push({ label: MONTHS[m - 1], left: pct(iso, end).toFixed(2) + '%' });
  }
  return out;
}
