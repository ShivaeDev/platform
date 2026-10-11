export function itemStyles(): string {
	return `
.document-view:has(.document-layout) { max-width: 1220px; }
.page:has(> .document-view > .document-layout) > .bar,
.page:has(> .document-view > .document-layout) > .preferences { max-height: 25vh; overflow: auto; }
.document-view:has(.document-layout) > .response-panel { max-width: 72ch; margin-inline: 0; }
.document-layout { display: grid; gap: 20px; grid-template-columns: minmax(0, 1fr); }
.document-layout > * { min-width: 0; }
.item-introduction h1 { margin: 0 0 .6em; }
.item-summary { padding: 12px 16px; background: var(--surface); border-left: 3px solid var(--link); border-radius: 4px; overflow-wrap: anywhere; }
.item-summary p { margin: 0; }
.item-summary p + p { margin-top: 8px; }
.item-context { align-self: start; margin: 0; padding: 12px 16px; border: 1px solid var(--border); border-radius: 8px; font-size: .9rem; overflow-wrap: anywhere; }
.item-context > summary { color: var(--text); font-weight: 600; }
.item-context .work-meta, .item-context .work-context { margin: 16px 0; padding: 0; border: 0; background: transparent; }
.item-context .reading-tools { margin: 16px 0 0; }
.document-layout > .doc > :first-child { margin-top: 0; }
@media (min-width: 1100px) {
  .document-layout { grid-template-columns: minmax(0, 72ch) minmax(240px, 280px); grid-template-rows: auto 1fr; gap: 24px 32px; }
  .item-introduction { grid-column: 1; grid-row: 1; }
  .item-context { grid-column: 2; grid-row: 1 / span 2; }
  .document-layout > .doc { grid-column: 1; grid-row: 2; }
}
@media print {
  .document-layout { display: block; }
  .item-context { display: none; }
}
`;
}
