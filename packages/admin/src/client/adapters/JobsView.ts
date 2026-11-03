import { Cause, Option, Predicate } from "effect";
import { createElement, useState } from "react";
import { useQuery } from "@shivaedev/react/client/resultState.ts";
import { JobsHealthMetrics } from "./JobsMetrics.tsx";
import { JobsQueuePicker, JobsQueueView } from "./JobsQueueView.tsx";
import type { JobsViewClient, RetryJob } from "./jobsTypes.ts";

export interface JobsViewProps {
	readonly api: JobsViewClient;
	readonly queues: readonly string[];
	readonly retry?: RetryJob | undefined;
}

export function JobsView({ api, queues, retry }: JobsViewProps) {
	const [queue, selectQueue] = useState(queues[0] ?? "");
	const health = useQuery(api.health.query(undefined));
	const denied = Option.exists(Option.flatMap(health.cause, Cause.findErrorOption), (error) => Predicate.isTagged(error, "Forbidden"));
	if (denied) {
		return createElement("p", { role: "alert" }, "Permission required to view jobs.");
	}
	return createElement(
		"div",
		{ className: "min-w-0 space-y-8" },
		createElement(JobsHealthMetrics, { state: health }),
		queues.length === 0
			? createElement("p", null, "No queues or schedules registered.")
			: createElement(
					"div",
					{ className: "min-w-0 space-y-6" },
					createElement(JobsQueuePicker, { queues, select: selectQueue, value: queue }),
					createElement(JobsQueueView, { api, key: queue, queue, retry }),
				),
	);
}
