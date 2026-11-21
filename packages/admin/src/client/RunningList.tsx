import { useState } from "react";
import { useQuery } from "@shivaedev/react/client/resultState.ts";
import { JobPagination } from "#client/JobPagination.tsx";
import { JobsQueryPanel } from "#client/JobsQueryPanel.tsx";
import { JobCell } from "#client/JobTable.tsx";
import type { JobsViewClient } from "#client/jobsTypes.ts";
import { Timestamp } from "#client/Timestamp.tsx";
import { timeLeftText } from "#client/timeLeftText.ts";
import type { DateDisplay } from "#client/timestampText.ts";
import type { JobsRunning } from "#jobs/Running.ts";

export function RunningList({ api, dates, queue }: { readonly api: JobsViewClient; readonly dates: DateDisplay; readonly queue: string }) {
	const [cursors, setCursors] = useState<readonly string[]>([]);
	const cursor = cursors.at(-1);
	const state = useQuery(api.running.query({ ...(cursor === undefined ? {} : { cursor }), limit: 10, queue }));
	return (
		<JobsQueryPanel state={state}>
			{(page) => (
				<>
					<RunningTable dates={dates} jobs={page.jobs} />
					<JobPagination change={setCursors} cursors={cursors} next={page.next} pending={state.pending} />
				</>
			)}
		</JobsQueryPanel>
	);
}

function RunningTable({ dates, jobs }: { readonly dates: DateDisplay; readonly jobs: readonly JobsRunning[] }) {
	if (jobs.length === 0) {
		return <p>No running jobs.</p>;
	}
	return (
		<table className="block w-full text-left text-sm sm:table">
			<caption className="sr-only">Running jobs and their deadlines</caption>
			<thead className="hidden sm:table-header-group">
				<tr>
					{["Queue", "Job", "Attempt", "Started", "Time left"].map((label) => (
						<th className="p-3" key={label} scope="col">
							{label}
						</th>
					))}
				</tr>
			</thead>
			<tbody className="grid gap-4 sm:table-row-group">
				{jobs.map((job) => (
					<RunningRow dates={dates} job={job} key={job.id} />
				))}
			</tbody>
		</table>
	);
}

function RunningRow({ dates, job }: { readonly dates: DateDisplay; readonly job: JobsRunning }) {
	return (
		<tr className="block min-w-0 rounded-md border sm:table-row">
			<JobCell label="Queue">{job.queue}</JobCell>
			<JobCell label="Job">{job.id}</JobCell>
			<JobCell label="Attempt">{job.attempt}</JobCell>
			<JobCell label="Started">
				<Timestamp dates={dates} time={job.startedOn} />
			</JobCell>
			<JobCell label="Time left">{timeLeftText(job.timeLeft)}</JobCell>
		</tr>
	);
}
