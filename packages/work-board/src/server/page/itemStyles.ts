export function itemStyles(): string {
	return `
.document-view:has(.document-layout) { max-width: 1220px; }
.page:has(.document-layout) > .bar,
.page:has(.document-layout) > .preferences { max-height: 25vh; overflow: auto; }
.document-view:has(.document-layout) > .response-panel { max-width: 72ch; margin-inline: 0; }
.item-context .work-meta, .item-context .work-context { margin: 16px 0; padding: 0; border: 0; background: transparent; }
.item-introduction { grid-column: 1 / -1; }
.document-layout > * { min-width: 0; }
@media print {
  .document-layout { display: block; }
  .item-context { display: none; }
}
`;
}
