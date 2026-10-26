import { useState } from "react";
import type { JobsHealth } from "@shivaedev/admin/jobs/schemas.ts";
import { useQuery } from "@shivaedev/effect-react/client/resultState.ts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#client/ui/tabs.tsx";
import { JobList } from "./JobList.tsx";
import type { JobsViewClient, RetryJob } from "./jobsTypes.ts";
import { Metrics } from "./Metrics.tsx";
import { QueryPanel } from "./QueryPanel.tsx";

export function JobsView({
	api,
	queues,
	retry,
}: {
	readonly api: JobsViewClient;
	readonly queues: readonly { readonly name: string }[];
	readonly retry?: RetryJob | undefined;
}) {
	const [queue, selectQueue] = useState(queues[0]?.name ?? "");
	const health = useQuery(api.health.query());
	return (
		<div className="space-y-8">
			<section aria-label="Jobs health" className="space-y-4">
				<h2 className="font-semibold text-xl">Health</h2>
				<QueryPanel state={health}>{(value) => <Metrics values={healthValues(value)} />}</QueryPanel>
			</section>
			{queues.length > 0 && (
				<>
					<QueuePicker queues={queues} select={selectQueue} value={queue} />
					<QueueView api={api} key={queue} queue={queue} retry={retry} />
				</>
			)}
		</div>
	);
}

function QueueView({ api, queue, retry }: { readonly api: JobsViewClient; readonly queue: string; readonly retry: RetryJob | undefined }) {
	const counts = useQuery(api.counts.query({ queue }));
	return (
		<>
			<section aria-label="Queue counts" className="space-y-4">
				<h2 className="font-semibold text-xl">Queue counts</h2>
				<QueryPanel state={counts}>
					{(value) => (
						<Metrics values={{ Active: value.activeCount, Failed: value.failedCount, Queued: value.queuedCount, Total: value.totalCount }} />
					)}
				</QueryPanel>
			</section>
			<Tabs defaultValue="failed">
				<TabsList>
					<TabsTrigger value="failed">Failed</TabsTrigger>
					<TabsTrigger value="deadLettered">Dead-lettered</TabsTrigger>
				</TabsList>
				<TabsContent value="failed">
					<JobList api={api} kind="failed" queue={queue} retry={retry} />
				</TabsContent>
				<TabsContent value="deadLettered">
					<JobList api={api} kind="deadLettered" queue={queue} retry={retry} />
				</TabsContent>
			</Tabs>
		</>
	);
}

function healthValues(value: typeof JobsHealth.Type) {
	return {
		Active: value.activeTotal,
		"Dead-lettered": value.deadLetteredTotal,
		Failed: value.failedTotal,
		Queued: value.queuedTotal,
		Ready: value.readyTotal,
	};
}
function QueuePicker({
	queues,
	select,
	value,
}: {
	readonly queues: readonly { readonly name: string }[];
	readonly select: (name: string) => void;
	readonly value: string;
}) {
	return (
		<label className="flex flex-col gap-2 text-sm sm:max-w-sm">
			Queue
			<select className="h-10 rounded-md border bg-background px-3" onChange={(event) => select(event.target.value)} value={value}>
				{queues.map(({ name }) => (
					<option key={name} value={name}>
						{name}
					</option>
				))}
			</select>
		</label>
	);
}
