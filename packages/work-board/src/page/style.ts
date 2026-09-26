const tokens = `
:root {
  color-scheme: light dark;
  --sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --mono: ui-monospace, SFMono-Regular, Menlo, monospace;
  --bg: #ffffff; --surface: #f6f8fa; --text: #1f2328; --muted: #59636e; --border: #d1d9e0; --link: #0969da; --danger: #b3261e;
}
@media (prefers-color-scheme: dark) {
  :root { --bg: #1e1e1e; --surface: #272727; --text: #e8e8e8; --muted: #a8a8a8; --border: #3d3d3d; --link: #58a6ff; --danger: #ff8a80; }
}
`;

const page = `
body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.65 var(--sans); }
a { color: var(--link); }
.page { box-sizing: content-box; max-width: 72ch; margin: 0 auto; padding: 0 16px 64px; }
.bar { display: flex; align-items: flex-start; gap: 16px; padding: 12px 0; border-bottom: 1px solid var(--border); font-size: 14px; }
.files { flex: 1; display: flex; flex-wrap: wrap; gap: 4px 16px; align-items: baseline; }
.files a { color: var(--text); text-decoration: none; }
.files a:hover, .files a[aria-current="page"] { color: var(--link); text-decoration: underline; }
.files details[open] { flex-basis: 100%; }
.files summary { cursor: pointer; color: var(--muted); }
.files ul { list-style: none; margin: 4px 0 8px; padding: 0 0 0 12px; border-left: 1px solid var(--border); }
.age { color: var(--muted); font: 12px var(--mono); margin-left: 6px; }
.live { color: var(--muted); font: 12px/1.9 var(--mono); }
.live[data-state="down"], .live[data-state="stale"] { color: var(--danger); }
.meta { color: var(--muted); font-size: 14px; margin: 0; }
.meta .age { margin: 0; }
`;

const prose = `
h1, h2, h3, h4 { font-weight: 600; line-height: 1.25; margin: 1.6em 0 0.5em; }
h1 { font-size: 1.9em; margin-top: 1em; }
h2 { font-size: 1.45em; }
h3 { font-size: 1.15em; }
h1 strong, h2 strong, h3 strong { font-weight: inherit; }
p, ul, ol, pre, table, blockquote, details, figure { margin: 0 0 1.1em; }
li + li { margin-top: 0.25em; }
.contains-task-list { list-style: none; padding-left: 0.4em; }
hr { border: 0; border-top: 1px solid var(--border); margin: 2em 0; }
blockquote { padding-left: 1em; border-left: 3px solid var(--border); color: var(--muted); }
code { font: 0.875em var(--mono); background: var(--surface); padding: 0.1em 0.35em; border-radius: 4px; overflow-wrap: anywhere; }
pre { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 12px 14px; white-space: pre-wrap; overflow-wrap: anywhere; }
pre code { background: none; padding: 0; font-size: 0.85em; }
.shiki span { color: var(--shiki-light); }
@media (prefers-color-scheme: dark) { .shiki span { color: var(--shiki-dark); } }
table { display: block; max-width: 100%; overflow-x: auto; border-collapse: collapse; font-size: 0.925em; }
th, td { text-align: left; vertical-align: top; padding: 6px 10px; border: 1px solid var(--border); }
tr:nth-child(2n) td { background: var(--surface); }
@media (max-width: 600px) { table { table-layout: fixed; } td, th { overflow-wrap: anywhere; } }
summary { cursor: pointer; color: var(--muted); }
details[open] > summary { margin-bottom: 0.5em; }
img, svg { max-width: 100%; height: auto; }
.empty { color: var(--muted); font-style: italic; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
`;

const board = `
.board-head .intro { color: var(--muted); }
.counts { margin: 0; }
.counts b { font-variant-numeric: tabular-nums; }
.board section { margin-top: 2.2em; }
.board section > h2 { margin: 0 0 0.2em; }
.item, .notes { padding: 0.9em 0 0.1em; border-top: 1px solid var(--border); }
.item > h3 { margin: 0 0 0.4em; }
.item > h3 > code:first-child { background: none; padding: 0; margin-right: 0.6em; color: var(--muted); font-weight: 400; }
footer { margin-top: 2.5em; padding-top: 1em; border-top: 1px solid var(--border); color: var(--muted); font-size: 0.925em; }
`;

const diagrams = `
figure.diagram { margin-left: 0; margin-right: 0; }
figure.diagram[data-state="pending"] { min-height: 12rem; background: var(--surface); border-radius: 6px; }
figure.diagram .diagram-source { display: none; }
figure.diagram[data-state="failed"] .diagram-source { display: block; }
figure.diagram[data-state="failed"]::after { content: attr(data-error); color: var(--danger); font-size: 0.875em; }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
`;

export const style = tokens + page + prose + board + diagrams;
