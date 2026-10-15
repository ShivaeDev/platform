import type { WorkProjection } from "#browser/views/schema.ts";
import { WorkCards } from "./WorkCards.tsx";
import { WorkNow } from "./WorkNow.tsx";
import { WorkTable } from "./WorkTable.tsx";
export function WorkResults({ data }: { readonly data: WorkProjection }) {
	if (data.state.view === "now") {
		return <WorkNow data={data} />;
	}
	if (data.rows.length === 0) {
		return <p className="empty">No work matches these filters.</p>;
	}
	return data.state.view === "table" ? <WorkTable data={data} /> : <WorkCards data={data} />;
}
