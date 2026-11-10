import { Option } from "effect";
import { type ReactNode, useState } from "react";
import type { QueueDisplay } from "@shivaedev/jobs/display.ts";
import { useQuery } from "@shivaedev/react/client/resultState.ts";
import { JobDetail, JobRecord } from "#client/adapters/JobDetail.tsx";
import { JobPagination } from "#client/adapters/JobPagination.tsx";
import { JobsQueryPanel } from "#client/adapters/JobsQueryPanel.tsx";
import { JobTable } from "#client/adapters/JobTable.tsx";
import type { AdminJob, JobsViewClient, RetryJob } from "#client/jobsTypes.ts";

export function JobList({
	api,
	queue,
	kind,
	retry,
	subject,
}: {
	readonly api: JobsViewClient;
	readonly queue: string;
	readonly kind: "failed" | "deadLettered";
	readonly retry: RetryJob | undefined;
	readonly subject?: QueueDisplay["subject"];
}) {
	const [cursors, setCursors] = useState<readonly string[]>([]);
	const [selectedId, select] = useState<string>();
	const cursor = cursors.at(-1);
	const state = useQuery(api[kind].query({ ...(cursor === undefined ? {} : { cursor }), limit: 10, queue }));
	const selected = Option.flatMap(state.data, (page) => Option.fromUndefinedOr(page.jobs.find((job) => job.id === selectedId)));
	let selectedDetail: ReactNode = null;
	if (selectedId !== undefined) {
		if (kind === "failed") {
			selectedDetail = <JobDetail api={api} id={selectedId} key={selectedId} queue={queue} retry={retry} />;
		} else if (Option.isSome(selected)) {
			selectedDetail = (
				<section aria-label="Dead-letter detail">
					<h2 className="mb-4 text-xl font-semibold">Dead-letter detail</h2>
					<JobRecord job={selected.value} />
				</section>
			);
		}
	}
	function selectJob(job: AdminJob) {
		select(job.id);
	}
	function changePage(next: readonly string[]) {
		setCursors(next);
		select(undefined);
	}
	function renderPage(page: { readonly jobs: readonly AdminJob[]; readonly next: Option.Option<string> }) {
		const kindLabel = kind === "failed" ? "failed" : "dead-lettered";
		const emptyMessage = page.jobs.length === 0 ? <p>No {kindLabel} jobs.</p> : null;
		const table = page.jobs.length === 0 ? null : <JobTable jobs={page.jobs} select={selectJob} subject={subject} />;
		return (
			<>
				{emptyMessage}
				{table}
				<JobPagination change={changePage} cursors={cursors} next={page.next} pending={state.pending} />
			</>
		);
	}
	return (
		<div className="space-y-6">
			<JobsQueryPanel state={state}>{renderPage}</JobsQueryPanel>
			{selectedDetail}
		</div>
	);
}
