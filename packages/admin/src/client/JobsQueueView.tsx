import { useState } from "react";
import { useQuery } from "@shivaedev/react/client/resultState.ts";
import { JobList } from "./JobList.tsx";
import { JobsMetrics } from "./JobsMetrics.tsx";
import { JobsQueryPanel } from "./JobsQueryPanel.tsx";
import type { JobsViewClient, RetryJob } from "./jobsTypes.ts";

export function JobsQueueView({ api, queue, retry }: { readonly api: JobsViewClient; readonly queue: string; readonly retry: RetryJob | undefined }) {
	const [kind, setKind] = useState<"failed" | "deadLettered">("failed");
	const counts = useQuery(api.counts.query({ queue }));
	return (
		<>
			<section aria-label="Queue counts" className="space-y-4">
				<h2 className="text-xl font-semibold">Queue counts</h2>
				<JobsQueryPanel state={counts}>
					{(value) => (
						<JobsMetrics values={{ Active: value.activeCount, Failed: value.failedCount, Queued: value.queuedCount, Total: value.totalCount }} />
					)}
				</JobsQueryPanel>
			</section>
			<div aria-label="Job lists" className="flex flex-wrap gap-3" role="tablist">
				{(
					[
						["failed", "Failed"],
						["deadLettered", "Dead-lettered"],
					] as const
				).map(([value, label]) => (
					<button
						aria-controls={`jobs-${value}-panel`}
						aria-selected={kind === value}
						className="rounded-md border px-3 py-2"
						id={`jobs-${value}-tab`}
						key={value}
						onClick={() => setKind(value)}
						role="tab"
						type="button"
					>
						{label}
					</button>
				))}
			</div>
			<div aria-labelledby={`jobs-${kind}-tab`} id={`jobs-${kind}-panel`} role="tabpanel">
				<JobList api={api} key={kind} kind={kind} queue={queue} retry={retry} />
			</div>
		</>
	);
}

export function JobsQueuePicker({
	queues,
	select,
	value,
}: {
	readonly queues: readonly string[];
	readonly select: (queue: string) => void;
	readonly value: string;
}) {
	return (
		<label className="flex min-w-0 flex-col gap-2 text-sm sm:max-w-sm">
			Queue
			<select
				className="bg-background h-10 w-full max-w-full min-w-0 rounded-md border px-3"
				onChange={(event) => select(event.target.value)}
				value={value}
			>
				{queues.map((name) => (
					<option key={name} value={name}>
						{name}
					</option>
				))}
			</select>
		</label>
	);
}
