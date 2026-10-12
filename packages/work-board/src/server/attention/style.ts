export function attentionStyle(): string {
	return `
.attention-total{margin:24px 0 8px;font-weight:600}.attention-order,.attention-footnote{font-size:13px;color:var(--muted);margin:0 0 24px;overflow-wrap:anywhere}
.attention-groups{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;align-items:start}.attention-group{min-width:0}.attention-group>h2{display:flex;justify-content:space-between;gap:12px;font-size:16px;margin:0 0 16px}.attention-group>h2>span{font:12px var(--mono);color:var(--muted)}
.attention-card{border:1px solid var(--border);border-radius:10px;padding:var(--card-space);background:var(--card);margin:0 0 16px;overflow-wrap:anywhere}.attention-card h3{font-size:1rem;margin:6px 0}.attention-card h3 a{text-decoration:none}.attention-card dl{font-size:13px;margin:16px 0}.attention-card dt{color:var(--muted);margin-top:12px}.attention-card dd{margin:4px 0}.attention-source{font-size:12px}.attention-reason{font-size:14px;margin:0}.attention-footnote{margin-top:24px}.attention-incomplete{padding:16px;border:1px solid var(--danger);border-radius:8px;margin:24px 0;overflow-wrap:anywhere}
[id^="attention-request-"],[id^="attention-record-"]{scroll-margin-top:20px}
@media(max-width:1100px){.attention-groups{grid-template-columns:minmax(0,1fr)}}
`;
}
