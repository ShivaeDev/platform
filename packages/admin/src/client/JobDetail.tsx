import { DateTime, Option } from "effect";
import { useAction, useQuery } from "@shivaedev/react/client/resultState.ts";
import { JobButton } from "./JobButton.tsx";
import { JobsQueryPanel } from "./JobsQueryPanel.tsx";
import type { AdminJob, JobsViewClient, RetryJob } from "./jobsTypes.ts";

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
			<h2 className="mb-4 text-xl font-semibold">Job detail</h2>
			<JobsQueryPanel state={state}>
				{(job) => (Option.isSome(job) ? <JobRecord job={job.value} retry={retry} /> : <p>Job not found.</p>)}
			</JobsQueryPanel>
		</section>
	);
}

export function JobRecord({ job, retry }: { readonly job: AdminJob; readonly retry?: RetryJob | undefined }) {
	const failure = ("sourceOutput" in job ? job.sourceOutput : job.output)?.message ?? "No failure recorded.";
	return (
		<div className="min-w-0 rounded-md border p-4">
			<div className="min-w-0 space-y-4">
				<dl className="grid min-w-0 gap-3 text-sm wrap-anywhere sm:grid-cols-2">
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
				<pre className="bg-muted max-w-full overflow-auto rounded-md p-3 text-xs">{JSON.stringify(job.data, null, 2)}</pre>
				<h3 className="font-medium">Failure</h3>
				<p className="wrap-anywhere">{failure}</p>
				<h3 className="font-medium">Output</h3>
				<pre className="bg-muted max-w-full overflow-auto rounded-md p-3 text-xs">{JSON.stringify(job.output, null, 2)}</pre>
				{"sourceId" in job && (
					<>
						<h3 className="font-medium">Dead-letter source</h3>
						<p className="text-sm break-all">{Option.getOrElse(job.sourceId, () => "Unknown original")}</p>
						<pre className="bg-muted max-w-full overflow-auto rounded-md p-3 text-xs">{JSON.stringify(job.sourceOutput, null, 2)}</pre>
					</>
				)}
				{retry !== undefined && job.state === "failed" && !("sourceId" in job) && <RetryControl job={job} retry={retry} />}
			</div>
		</div>
	);
}

function RetryControl({ job, retry }: { readonly job: AdminJob; readonly retry: RetryJob }) {
	const action = useAction(retry);
	return (
		<div className="space-y-2">
			<JobButton disabled={action.pending} onClick={() => action.dispatch({ id: job.id, queue: job.queue })}>
				{action.pending ? "Retrying…" : "Retry job"}
			</JobButton>
			{Option.isSome(action.cause) && <p role="alert">Could not retry this job. Refresh and try again.</p>}
			{Option.isSome(action.data) && <p role="status">Retry requested.</p>}
		</div>
	);
}
