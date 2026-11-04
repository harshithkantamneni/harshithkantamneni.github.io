// Small chart helpers. Bar width and printed value come from the same number, so they can't disagree.
const clamp = (x) => Math.max(0, Math.min(1, x));
const scale = (value, min, max) => clamp((value - min) / (max - min));

function track(value, min, max, mark) {
  const tick = mark === undefined ? '' : `<span class="limit" style="left:${(scale(mark, min, max) * 100).toFixed(2)}%"></span>`;
  return `<span class="bt${mark === undefined ? '' : ' over'}"><i style="transform:scaleX(${scale(value, min, max).toFixed(4)})"></i>${tick}</span>`;
}

export function hbar({ label, value, max, text, tone = '', min = 0, mark }) {
  return `<div class="hb ${tone}"><span>${label}</span>${track(value, min, max, mark)}<span class="hb-v">${text ?? value}</span></div>`;
}

export const bars = (rows, common = {}) => `<div class="bars">${rows.map((r) => hbar({ ...common, ...r })).join('')}</div>`;

// Grouped bars: one label on the left, thin bars with their values on the right. The legend names the series.
export const clusters = (groups, { max, min = 0 }) => `<div class="cls">${groups.map((g) => `
  <div class="cl"><div class="cl-l">${g.label}${g.note ? `<span>${g.note}</span>` : ''}</div>
    <div class="cl-b">${g.bars.map((b) => `<div class="clb ${b.tone || ''}">${track(b.value, min, max)}<span class="hb-v">${b.text ?? b.value}</span></div>`).join('')}</div>
  </div>`).join('')}</div>`;

// Line chart with HTML labels, so text stays a readable size at any width.
export function lines({ xs, series, y, height = 280 }) {
  const paths = series.map((s) => `<polyline points="${xs.map((x, i) => `${x},${y(s.values[i]).toFixed(2)}`).join(' ')}" fill="none" stroke="${s.color}" stroke-width="2" vector-effect="non-scaling-stroke"${s.dash ? ` stroke-dasharray="${s.dash}"` : ''}></polyline>`).join('');
  const pts = series.map((s) => s.values.map((v, i) => {
    const edge = i === xs.length - 1 ? ' end' : i === 0 ? ' start' : '';
    return `<span class="pt ${s.side}${edge}" style="left:${xs[i]}%;top:${y(v).toFixed(2)}%;--pc:${s.color}"><i></i><b>${s.labels[i]}</b></span>`;
  }).join('')).join('');
  return `<div class="lc" style="height:${height}px"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${paths}</svg>${pts}</div>`;
}
