import { Suspense, use } from "react";
import type { WorkProjection } from "#browser/views/schema.ts";
import { viewUrl } from "#browser/views/state.ts";
import { EmptyState } from "./EmptyState.tsx";
import { LinkButton } from "./LinkButton.tsx";
import { workTableChunk } from "./lazyChunks.ts";
import { SkeletonTable } from "./skeletons.tsx";
import { WorkCards } from "./WorkCards.tsx";
import { WorkNow } from "./WorkNow.tsx";

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
	return data.state.view === "table" ? (
		<Suspense fallback={<SkeletonTable />}>
			<LoadedWorkTable data={data} />
		</Suspense>
	) : (
		<WorkCards data={data} />
	);
}

function LoadedWorkTable({ data }: { readonly data: WorkProjection }) {
	const table = workTableChunk.loaded() ?? use(workTableChunk.load());
	return "error" in table ? (
		<p data-work-table-error="" role="status">
			The table could not be loaded: {table.error}. Reload the page to try again.
		</p>
	) : (
		<table.WorkTable data={data} />
	);
}
