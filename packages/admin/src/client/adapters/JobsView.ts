import { Cause, Option, Predicate } from "effect";
import { createElement, useState } from "react";
import type { QueueDisplay } from "@shivaedev/jobs/display.ts";
import { useQuery } from "@shivaedev/react/client/resultState.ts";
import { JobsHealthMetrics } from "./JobsMetrics.tsx";
import { JobsQueuePicker, JobsQueueView } from "./JobsQueueView.tsx";
import type { JobsViewClient, RetryJob } from "./jobsTypes.ts";

export interface JobsViewProps {
	readonly api: JobsViewClient;
	readonly queues: readonly (string | QueueDisplay)[];
	readonly retry?: RetryJob | undefined;
}

export function JobsView({ api, queues, retry }: JobsViewProps) {
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
					createElement(JobsQueueView, { api, key: name, label: queue.label, queue: name, retry, subject: queue.subject }),
				),
	);
}
