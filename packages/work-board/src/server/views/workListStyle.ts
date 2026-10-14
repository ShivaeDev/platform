export function workListStyle(): string {
	return `
.work-options{margin:12px 0}.work-options>summary{cursor:pointer;width:fit-content}
.work-columns{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(240px,1fr);gap:16px;overflow-x:auto;padding-bottom:12px}
.work-now{grid-template-columns:repeat(6,minmax(240px,1fr));grid-auto-columns:auto}
.work-card-list{height:min(60vh,600px);overflow:auto;padding:2px}
.work-card-slot{height:224px;padding-bottom:12px}
.work-card-slot .work-card{height:212px;overflow:hidden;margin:0;display:flex;flex-direction:column;gap:6px;padding:12px}
.work-card-slot .work-card>*{flex-shrink:0}
.work-card-slot h3{margin:0;font-size:14px;line-height:20px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.work-card-slot .work-owner,.work-card-slot .work-stage{margin:0;font-size:12px}
.work-column h2 button{font:inherit;text-align:left}
.work-virtual-row{height:96px}
.work-virtual-row :is(th,td){padding:8px}
.work-virtual-row .work-cell{max-height:72px;overflow:hidden}
.work-virtual-row td{max-width:220px}
.work-table-wrap{max-height:min(60vh,600px)}
@media(min-width:1280px){.work-now{grid-template-columns:repeat(6,minmax(0,1fr))}.work-now .work-column>h2{min-height:40px}.has-detail .work-now{grid-template-columns:repeat(6,minmax(240px,1fr))}}
`;
}
