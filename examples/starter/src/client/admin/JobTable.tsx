import { Button } from "#client/ui/button.tsx";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "#client/ui/table.tsx";
import type { AdminJob } from "./jobsTypes.ts";

export function JobTable({ jobs, select }: { readonly jobs: readonly AdminJob[]; readonly select: (job: AdminJob) => void }) {
	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>Job</TableHead>
					<TableHead>State</TableHead>
					<TableHead>Attempt</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{jobs.map((job) => (
					<JobRow job={job} key={job.id} select={select} />
				))}
			</TableBody>
		</Table>
	);
}

function JobRow({ job, select }: { readonly job: AdminJob; readonly select: (job: AdminJob) => void }) {
	return (
		<TableRow>
			<TableCell>
				<Button onClick={() => select(job)} variant="link">
					{job.id}
				</Button>
			</TableCell>
			<TableCell>{job.state}</TableCell>
			<TableCell>{job.attempt}</TableCell>
		</TableRow>
	);
}
