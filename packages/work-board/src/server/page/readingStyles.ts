export function readingStyles(): string {
	return `
.reading-tools { display: flex; align-items: start; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; font-size: 13px; }
.reading-tools button[aria-pressed="true"] { background: var(--surface); border-color: var(--link); }
.outline { margin: 0; min-width: 180px; max-width: 100%; }
.outline > summary { padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px; color: var(--text); }
.outline nav { margin-top: 12px; padding: 0 12px; max-height: 40vh; overflow-y: auto; }
.outline ol { padding-left: 18px; }
.outline li { overflow-wrap: anywhere; }
.outline li[data-depth="3"], .outline li[data-depth="4"] { margin-left: 12px; }
.outline li[data-depth="5"], .outline li[data-depth="6"] { margin-left: 24px; }
.heading-anchor { display: inline-block; margin-left: 8px; font-size: 0.7em; text-decoration: none; opacity: 0.35; }
.heading-anchor::after { content: "#"; }
.heading-anchor:hover, .heading-anchor:focus-visible { opacity: 1; }
[id^="heading-"] { scroll-margin-top: 20px; }
#library-dialog { width: min(560px, calc(100vw - 32px)); max-height: min(600px, calc(100dvh - 32px)); overflow-y: auto; padding: 20px; color: var(--text); background: var(--card); border: 1px solid var(--border); border-radius: 12px; }
#library-dialog::backdrop { background: rgb(0 0 0 / .45); }
.reading-library { font-size: 14px; margin-top: 20px; }
.reading-library .nav-heading { font-size: 14px; }
.reading-library[hidden] { display: none; }
.reading-library ul { list-style: none; padding: 0 12px; margin: 0 0 20px; }
.reading-library a { color: var(--link); overflow-wrap: anywhere; }
.reading-library a[aria-current="page"] { font-weight: 600; }
.reading-library .missing { color: var(--muted); }
.library-status { padding: 0 12px; color: var(--muted); }
#navigation-status { color: var(--danger); overflow-wrap: anywhere; }
#navigation-status:empty { display: none; }
.bar:has(#navigation-status:not(:empty)) { flex-wrap: wrap; }
#navigation-status:not(:empty) { flex-basis: 100%; }
`;
}
