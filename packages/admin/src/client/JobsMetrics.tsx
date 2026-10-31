import type { QueryState } from "@shivaedev/react/client/resultState.ts";
import type { JobsHealth } from "#jobs/schemas.ts";
import { JobsQueryPanel } from "./JobsQueryPanel.tsx";

export function JobsMetrics({ values }: { readonly values: Readonly<Record<string, number>> }) {
	return (
		<dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
			{Object.entries(values).map(([label, value]) => (
				<div className="min-w-0 rounded-md border p-3 wrap-anywhere" key={label}>
					<dt>{label}</dt>
					<dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
				</div>
			))}
		</dl>
	);
}

export function JobsHealthMetrics({ state }: { readonly state: QueryState<typeof JobsHealth.Type, unknown> }) {
	return (
		<section aria-label="Jobs health" className="space-y-4">
			<h2 className="text-xl font-semibold">Health</h2>
			<JobsQueryPanel state={state}>
				{(value) => (
					<JobsMetrics
						values={{
							Active: value.activeTotal,
							"Dead-lettered": value.deadLetteredTotal,
							Failed: value.failedTotal,
							Queued: value.queuedTotal,
							Ready: value.readyTotal,
						}}
					/>
				)}
			</JobsQueryPanel>
		</section>
	);
}
