import { Predicate } from "effect";
import type { ReactNode } from "react";
import type { QueueDisplay } from "@shivaedev/jobs/display.ts";
import { JobButton } from "#client/adapters/JobButton.tsx";
import type { AdminJob } from "#client/adapters/jobsTypes.ts";

interface JobTableProps {
	readonly jobs: readonly AdminJob[];
	readonly select: (job: AdminJob) => void;
	readonly subject?: QueueDisplay["subject"];
}

const noSubjectColumns: NonNullable<QueueDisplay["subject"]> = [];

export function JobTable({ jobs, select, subject = noSubjectColumns }: JobTableProps) {
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
					{subject.map(({ field, label }) => (
						<th className="p-3" key={field} scope="col">
							{label}
						</th>
					))}
				</tr>
			</thead>
			<tbody className="grid gap-4 sm:table-row-group">
				{jobs.map((job) => (
					<JobRow job={job} key={job.id} select={select} subject={subject} />
				))}
			</tbody>
		</table>
	);
}

function JobRow({
	job,
	select,
	subject,
}: {
	readonly job: AdminJob;
	readonly select: (job: AdminJob) => void;
	readonly subject: NonNullable<QueueDisplay["subject"]>;
}) {
	const failure = ("sourceOutput" in job ? job.sourceOutput : job.output)?.message ?? "No failure recorded.";
	return (
		<tr className="block min-w-0 rounded-md border sm:table-row">
			<JobCell label="Job">
				<JobButton onClick={() => select(job)}>{job.id}</JobButton>
			</JobCell>
			<JobCell label="State">{job.state}</JobCell>
			<JobCell label="Attempt">{job.attempt}</JobCell>
			<JobCell label="Failure">{failure}</JobCell>
			{subject.map(({ field, label }) => (
				<JobCell key={field} label={label}>
					{subjectValue(job.data, field)}
				</JobCell>
			))}
		</tr>
	);
}

function subjectValue(data: unknown, field: string): string {
	const value = Predicate.isObject(data) ? data[field] : undefined;
	if (value === undefined || value === null) {
		return "—";
	}
	return typeof value === "string" ? value : JSON.stringify(value);
}

function JobCell({ label, children }: { readonly label: string; readonly children: ReactNode }) {
	return (
		<td className="block min-w-0 p-3 wrap-anywhere sm:table-cell">
			<span className="block font-medium sm:hidden">{label}</span>
			<div>{children}</div>
		</td>
	);
}
