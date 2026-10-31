import type { ReactNode } from "react";
import { JobButton } from "./JobButton.tsx";
import type { AdminJob } from "./jobsTypes.ts";

export function JobTable({ jobs, select }: { readonly jobs: readonly AdminJob[]; readonly select: (job: AdminJob) => void }) {
	return (
		<table className="block w-full text-left text-sm sm:table">
			<caption className="sr-only">Jobs and failures</caption>
			<thead className="hidden sm:table-header-group">
				<tr>
					{["Job", "State", "Attempt", "Failure"].map((label) => (
						<th className="p-3" key={label} scope="col">
							{label}
						</th>
					))}
				</tr>
			</thead>
			<tbody className="grid gap-4 sm:table-row-group">
				{jobs.map((job) => (
					<JobRow job={job} key={job.id} select={select} />
				))}
			</tbody>
		</table>
	);
}

function JobRow({ job, select }: { readonly job: AdminJob; readonly select: (job: AdminJob) => void }) {
	const failure = ("sourceOutput" in job ? job.sourceOutput : job.output)?.message ?? "No failure recorded.";
	return (
		<tr className="block min-w-0 rounded-md border sm:table-row">
			<JobCell label="Job">
				<JobButton onClick={() => select(job)}>{job.id}</JobButton>
			</JobCell>
			<JobCell label="State">{job.state}</JobCell>
			<JobCell label="Attempt">{job.attempt}</JobCell>
			<JobCell label="Failure">{failure}</JobCell>
		</tr>
	);
}

function JobCell({ label, children }: { readonly label: string; readonly children: ReactNode }) {
	return (
		<td className="block min-w-0 p-3 wrap-anywhere sm:table-cell">
			<span className="block font-medium sm:hidden">{label}</span>
			<div>{children}</div>
		</td>
	);
}
