import type { Picked, Reason } from './select.ts';

export type ReviewRow = Picked & { english: string | null; englishSource: string | null };

const SECTIONS: Array<{ title: string; reason: Reason }> = [
  { title: 'Deadly species', reason: 'deadly' },
  { title: 'Dangerous lookalikes of edible species', reason: 'dangerous-lookalike' },
  { title: 'Edible species', reason: 'edible' },
  { title: 'Added by you', reason: 'added-by-stefan' },
  { title: 'Most recorded in the UK', reason: 'most-recorded' },
];

const TAG: Record<Reason, string> = {
  deadly: 'Deadly',
  'dangerous-lookalike': 'Dangerous lookalike',
  edible: 'Edible',
  'added-by-stefan': 'Added by you',
  'most-recorded': 'Most recorded',
};

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);

export function sectionOf(r: ReviewRow): string {
  return SECTIONS.find((s) => r.reasons.includes(s.reason))!.title;
}

function rowHtml(r: ReviewRow): string {
  const img = r.photo
    ? `<img src="${esc(r.photo.url)}" alt="" loading="lazy" width="48" height="48" title="${esc(r.photo.attribution)}">`
    : '';
  const tags = r.reasons.map((x) => `<span class="tag ${x}">${TAG[x]}</span>`).join(' ');
  return (
    `<tr class="sp"><td class="ph">${img}</td>` +
    `<td><div class="en">${esc(r.english ?? '-')}</div><div class="sci">${esc(r.name)}</div></td>` +
    `<td class="num">${r.ukRecords.toLocaleString('en-GB')}</td>` +
    `<td>${tags}</td>` +
    `<td><a href="https://www.inaturalist.org/taxa/${r.inatId}">iNaturalist</a></td></tr>`
  );
}

export function renderReviewPage(
  rows: ReviewRow[],
  meta: { generated: string; target: number; notes: string[] },
): string {
  const groups = SECTIONS.map((s) => ({ title: s.title, rows: rows.filter((r) => sectionOf(r) === s.title) }));
  const body = groups
    .filter((g) => g.rows.length > 0)
    .map(
      (g) =>
        `<h2>${esc(g.title)} (${g.rows.length})</h2>` +
        `<table><thead><tr><th></th><th>Name</th><th>UK records</th><th>Why it is in</th><th></th></tr></thead>` +
        `<tbody>${g.rows.map(rowHtml).join('')}</tbody></table>`,
    )
    .join('\n');
  const notes = meta.notes.length
    ? `<h2>Notes</h2><ul>${meta.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>`
    : '';
  return `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mushroom guide: species list</title>
<style>
:root{--bg:#fff;--fg:#1d1d1f;--muted:#6e6e73;--line:#e5e5ea;--deadly:#b3261e;--danger:#b25c00;--edible:#1b7f3b;--plain:#4a4a4f}
@media (prefers-color-scheme: dark){:root{--bg:#161617;--fg:#f5f5f7;--muted:#a1a1a6;--line:#2c2c2e;--deadly:#ff6b60;--danger:#ffb04d;--edible:#5fd383;--plain:#c7c7cc}}
body{margin:0 auto;max-width:960px;padding:16px;background:var(--bg);color:var(--fg);font:15px/1.5 -apple-system,system-ui,sans-serif}
h1{font-size:22px;margin:8px 0}h2{font-size:17px;margin:28px 0 8px}
p.lead{color:var(--muted)}table{width:100%;border-collapse:collapse}
td,th{padding:6px 8px;border-bottom:1px solid var(--line);text-align:left;vertical-align:middle}
th{font-weight:500;color:var(--muted);font-size:13px}.num{text-align:right;white-space:nowrap}
.sci{font-style:italic;color:var(--muted);font-size:13px}.ph img{border-radius:6px;display:block}
.tag{font-size:12px;padding:1px 6px;border-radius:4px;border:1px solid currentColor;white-space:nowrap}
.deadly{color:var(--deadly)}.dangerous-lookalike{color:var(--danger)}.edible{color:var(--edible)}
.most-recorded,.added-by-stefan{color:var(--plain)}a{color:inherit}
@media (max-width:600px){td:nth-child(3),th:nth-child(3),td:nth-child(5),th:nth-child(5){display:none}}
</style></head><body>
<h1>Species list for your mushroom guide</h1>
<p class="lead">${rows.length} species (aim: about ${meta.target}). Made ${esc(meta.generated)}. Tell me any species to add or remove.
Deadly species and dangerous lookalikes always stay in.</p>
${notes}
${body}
</body></html>
`;
}
