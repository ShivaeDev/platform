import { attentionStyle } from "#attention/style.ts";
import { workStyle } from "#views/workStyle.ts";
import { metadataStyles } from "./metadata.ts";
import { readingStyles } from "./readingStyles.ts";
import { searchStyles } from "./searchDialog.ts";
import { visualStyles } from "./visualDialog.ts";
import { layout, theme } from "./workspaceStyles.ts";

const prose = `
h1, h2, h3, h4 { font-weight: 600; line-height: 1.25; margin: 1.6em 0 0.5em; }
h1 { overflow-wrap: anywhere; font-size: 1.9em; margin-top: 1em; }
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
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .shiki span { color: var(--shiki-dark); } }
:root[data-theme="dark"] .shiki span { color: var(--shiki-dark); }
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
.board { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 19rem), 1fr)); gap: var(--space); margin-top: 2em; align-items: start; }
.board section { min-width: 0; }
.board section > h2 { margin: 0 0 0.8em; font-size: 1.1em; overflow-wrap: anywhere; }
.item, .notes { padding: var(--card-space); margin-bottom: 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--card); overflow-wrap: anywhere; }
.item > :last-child, .notes > :last-child { margin-bottom: 0; }
.item > h3 { margin: 0 0 0.4em; }
.item > h3 > code:first-child { background: none; padding: 0; margin-right: 0.6em; color: var(--muted); font-weight: 400; }
footer { margin-top: 2.5em; padding-top: 1em; border-top: 1px solid var(--border); color: var(--muted); font-size: 0.925em; }
`;

const diagrams = `
[data-live-change] { outline: 2px solid var(--border); outline-offset: 3px; border-radius: 3px; }
figure.diagram { margin-left: 0; margin-right: 0; }
figure.diagram[data-state="pending"] { min-height: 12rem; background: var(--surface); border-radius: 6px; }
figure.diagram .diagram-source { display: none; }
figure.diagram[data-state="failed"] .diagram-source { display: block; }
[data-diagram-error] { color: var(--danger); font-size: 0.875em; }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
`;

const documents = `
.start-open { display: block; padding: 0 12px 18px; color: var(--sidebar-text); }
.onboarding { max-width: 76ch; }
.start-template textarea { display: block; box-sizing: border-box; width: 100%; margin: 12px 0; padding: 12px; font-family: var(--mono); font-size: 13px; color: var(--text); background: var(--surface); border: 1px solid var(--border); border-radius: 6px; }
@media print {
  .sidebar, .bar, .preferences, .reading-tools, .visual-tools { display: none !important; }
  .workspace { display: block !important; }
  .page { width: 100%; }
  #doc { padding: 0; }
  .doc pre, .doc table { white-space: pre-wrap; overflow: visible; }
  figure.diagram[data-state="pending"] .diagram-source, figure.diagram[data-state="failed"] .diagram-source { display: block; }
}

.visual-document, .visual-callout { border: 1px solid var(--border); border-radius: 12px; padding: 1em 1.2em; margin: 1.2em 0; overflow-wrap: anywhere; }
.visual-document > :last-child, .visual-callout > :last-child { margin-bottom: 0; }
.visual-label { font-weight: 650; margin-top: 0; }
.visual-value { font-size: 1.35em; font-variant-numeric: tabular-nums; }
.visual-document progress { display: block; width: 100%; height: 1em; accent-color: var(--link); }
.visual-timeline-entries { border-left: 2px solid var(--border); padding-left: 1.6em; }
.visual-timeline-entries > li { padding: .3em 0 .7em .2em; }
.visual-callout { border-left: 4px solid var(--link); background: var(--surface); }
.visual-warning, .visual-caution { border-left-color: #b97720; }
.visual-diagnostic { font-weight: 600; color: var(--muted); }
@media print { .visual-document, .visual-callout { break-inside: avoid; } }
`;

export const style =
	theme
	+ layout
	+ prose
	+ board
	+ diagrams
	+ readingStyles()
	+ searchStyles
	+ metadataStyles
	+ workStyle()
	+ attentionStyle()
	+ visualStyles
	+ documents;
