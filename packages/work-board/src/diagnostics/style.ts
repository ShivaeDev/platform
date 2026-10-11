export function diagnosticsStyle(): string {
	return `
.diagnostics { max-width: 1200px; margin: auto; padding: clamp(1rem, 3vw, 2rem); }
.diagnostics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); gap: 1rem; align-items: start; }
.diagnostics-card { min-width: 0; border: 1px solid var(--border); border-radius: 12px; padding: 1.25rem; background: var(--surface); overflow-wrap: anywhere; }
.diagnostics-card header { display: flex; align-items: baseline; flex-wrap: wrap; gap: .5rem 1rem; justify-content: space-between; }
.diagnostics-card h2 { margin: 0; }
.diagnostics-status { font-size: .85rem; border: 1px solid var(--border); border-radius: 1rem; padding: .2rem .6rem; }
.diagnostics-card[data-state=attention], .diagnostics-card[data-state=error] { border-color: var(--link); }
.diagnostics-card[data-state=stale] .diagnostics-metrics strong { opacity: .55; }
.diagnostics-freshness { font-size: .85rem; color: var(--muted); }
.diagnostics-windows { list-style: none; padding: 0; }
.diagnostics-windows li + li, .diagnostics-metrics > div + div { border-top: 1px solid var(--border); padding-top: .75rem; margin-top: .75rem; }
.diagnostics-windows h3 { margin-bottom: .25rem; }
.diagnostics-windows meter { width: 100%; height: .75rem; accent-color: var(--link); }
.diagnostics-metrics dt { color: var(--muted); }
.diagnostics-metrics dd { margin: .25rem 0 0; }
`;
}
