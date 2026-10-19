import type { WorkProjection } from "#browser/views/schema.ts";
import { viewUrl } from "#browser/views/state.ts";
import { EmptyState } from "./EmptyState.tsx";
import { LinkButton } from "./LinkButton.tsx";
import { WorkCards } from "./WorkCards.tsx";
import { WorkNow } from "./WorkNow.tsx";
import { WorkTable } from "./WorkTable.tsx";
export function WorkResults({ data }: { readonly data: WorkProjection }) {
	if (data.state.view === "now") {
		return <WorkNow data={data} />;
	}
	if (data.rows.length === 0) {
		return (
			<EmptyState
				action={<LinkButton href={viewUrl(data.state, { owner: "", query: "", status: "" }, "work-results")}>Clear filters</LinkButton>}
				title="No matching work"
			>
				No work matches these filters. Clear them to see every item in this view.
			</EmptyState>
		);
	}
	return data.state.view === "table" ? <WorkTable data={data} /> : <WorkCards data={data} />;
}
