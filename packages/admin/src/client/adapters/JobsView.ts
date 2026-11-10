import { Cause, Option, Predicate } from "effect";
import { createElement, useState } from "react";
import type { QueueDisplay } from "@shivaedev/jobs/display.ts";
import { useQuery } from "@shivaedev/react/client/resultState.ts";
import { JobsHealthMetrics } from "#client/adapters/JobsMetrics.tsx";
import { JobsQueuePicker, JobsQueueView } from "#client/adapters/JobsQueueView.tsx";
import { RunScheduleControl } from "#client/adapters/RunScheduleControl.tsx";
import type { JobsViewClient, RetryJob, RunScheduleNow } from "#client/jobsTypes.ts";

export interface JobsViewProps {
	readonly api: JobsViewClient;
	readonly queues: readonly (string | QueueDisplay)[];
	readonly retry?: RetryJob | undefined;
	readonly runScheduleNow?: RunScheduleNow | undefined;
	readonly schedules?: readonly { readonly name: string }[];
}

export function JobsView({ api, queues, retry, schedules, runScheduleNow }: JobsViewProps) {
	const definitions = queues.map((definition) => (typeof definition === "string" ? { name: definition } : definition));
	const [name, selectQueue] = useState(definitions[0]?.name ?? "");
	const queue = definitions.find((candidate) => candidate.name === name);
	const health = useQuery(api.health.query(undefined));
	const denied = Option.exists(Option.flatMap(health.cause, Cause.findErrorOption), (error) => Predicate.isTagged(error, "Forbidden"));
	if (denied) {
		return createElement("p", { role: "alert" }, "Permission required to view jobs.");
	}
	return createElement(
		"div",
		{ className: "min-w-0 space-y-8" },
		createElement(JobsHealthMetrics, { state: health }),
		queue === undefined
			? createElement("p", null, "No queues or schedules registered.")
			: createElement(
					"div",
					{ className: "min-w-0 space-y-6" },
					createElement(JobsQueuePicker, { queues: definitions, select: selectQueue, value: name }),
					runScheduleNow !== undefined && schedules?.some((schedule) => schedule.name === name)
						? createElement(RunScheduleControl, { key: `run-${name}`, queue: name, run: runScheduleNow })
						: null,
					createElement(JobsQueueView, { api, key: name, label: queue.label, queue: name, retry, subject: queue.subject }),
				),
	);
}
