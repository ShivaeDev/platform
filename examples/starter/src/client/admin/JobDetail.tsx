import { DateTime, Option } from "effect";
import { useAction, useQuery } from "@shivaedev/react/client/resultState.ts";
import { Button } from "#client/ui/button.tsx";
import { Card, CardContent } from "#client/ui/card.tsx";
import type { AdminJob, JobsViewClient, RetryJob } from "./jobsTypes.ts";
import { QueryPanel } from "./QueryPanel.tsx";

export function JobDetail({
	api,
	queue,
	id,
	retry,
}: {
	readonly api: JobsViewClient;
	readonly queue: string;
	readonly id: string;
	readonly retry: RetryJob | undefined;
}) {
	const state = useQuery(api.job.query({ id, queue }));
	return (
		<section aria-label="Job detail">
			<h2 className="mb-4 font-semibold text-xl">Job detail</h2>
			<QueryPanel state={state}>{(job) => (Option.isSome(job) ? <JobRecord job={job.value} retry={retry} /> : <p>Job not found.</p>)}</QueryPanel>
		</section>
	);
}

export function JobRecord({ job, retry }: { readonly job: AdminJob; readonly retry?: RetryJob | undefined }) {
	return (
		<Card>
			<CardContent className="min-w-0 space-y-4">
				<dl className="grid gap-3 break-words text-sm sm:grid-cols-2">
					{Object.entries({
						Attempt: job.attempt,
						Completed: Option.match(job.completedOn, { onNone: () => "—", onSome: DateTime.formatIso }),
						Created: DateTime.formatIso(job.createdOn),
						"ID": job.id,
						Queue: job.queue,
						"Retry count / limit": `${job.retryCount} / ${job.retryLimit}`,
						Started: Option.match(job.startedOn, { onNone: () => "—", onSome: DateTime.formatIso }),
						State: job.state,
					}).map(([label, value]) => (
						<div key={label}>
							<dt className="text-muted-foreground">{label}</dt>
							<dd>{value}</dd>
						</div>
					))}
				</dl>
				<h3 className="font-medium">Payload</h3>
				<pre className="overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(job.data, null, 2)}</pre>
				<h3 className="font-medium">Output</h3>
				<pre className="overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(job.output, null, 2)}</pre>
				{job.sourceId !== undefined && (
					<>
						<h3 className="font-medium">Dead-letter source</h3>
						<p className="break-all text-sm">{Option.getOrElse(job.sourceId, () => "Unknown original")}</p>
						<pre className="overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(job.sourceOutput, null, 2)}</pre>
					</>
				)}
				{retry !== undefined && job.state === "failed" && job.sourceId === undefined && <RetryControl job={job} retry={retry} />}
			</CardContent>
		</Card>
	);
}

function RetryControl({ job, retry }: { readonly job: AdminJob; readonly retry: RetryJob }) {
	const action = useAction(retry);
	return (
		<div className="space-y-2">
			<Button disabled={action.pending} onClick={() => action.dispatch({ id: job.id, queue: job.queue })}>
				{action.pending ? "Retrying…" : "Retry job"}
			</Button>
			{Option.isSome(action.cause) && <p role="alert">Could not retry this job. Refresh and try again.</p>}
			{Option.isSome(action.data) && <p role="status">Retry requested.</p>}
		</div>
	);
}
