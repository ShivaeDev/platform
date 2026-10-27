import { Option } from "effect";
import { useState } from "react";
import { useQuery } from "@shivaedev/react/client/resultState.ts";
import { JobDetail, JobRecord } from "./JobDetail.tsx";
import { JobPagination } from "./JobPagination.tsx";
import { JobTable } from "./JobTable.tsx";
import type { AdminJob, JobsViewClient, RetryJob } from "./jobsTypes.ts";
import { QueryPanel } from "./QueryPanel.tsx";

export function JobList({
	api,
	queue,
	kind,
	retry,
}: {
	readonly api: JobsViewClient;
	readonly queue: string;
	readonly kind: "failed" | "deadLettered";
	readonly retry: RetryJob | undefined;
}) {
	const [cursors, setCursors] = useState<readonly string[]>([]);
	const [selectedId, select] = useState<string>();
	const cursor = cursors.at(-1);
	const state = useQuery(api[kind].query({ ...(cursor === undefined ? {} : { cursor }), limit: 10, queue }));
	const selected = Option.flatMap(state.data, (page) => Option.fromUndefinedOr(page.jobs.find((job) => job.id === selectedId)));
	function selectJob(job: AdminJob) {
		select(job.id);
	}
	function changePage(next: readonly string[]) {
		setCursors(next);
		select(undefined);
	}
	return (
		<div className="space-y-6">
			<QueryPanel state={state}>
				{(page) => (
					<>
						{page.jobs.length === 0 ? (
							<p>No {kind === "failed" ? "failed" : "dead-lettered"} jobs.</p>
						) : (
							<JobTable jobs={page.jobs} select={selectJob} />
						)}
						<JobPagination change={changePage} cursors={cursors} next={page.next} pending={state.pending} />
					</>
				)}
			</QueryPanel>
			{selectedId !== undefined
				&& (kind === "failed" ? (
					<JobDetail api={api} id={selectedId} key={selectedId} queue={queue} retry={retry} />
				) : (
					Option.isSome(selected) && (
						<section aria-label="Dead-letter detail">
							<h2 className="mb-4 font-semibold text-xl">Dead-letter detail</h2>
							<JobRecord job={selected.value} />
						</section>
					)
				))}
		</div>
	);
}
