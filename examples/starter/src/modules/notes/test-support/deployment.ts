import { Effect } from "effect";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { deploymentProcesses } from "#test-support/deploymentProcesses.ts";
import { postgres } from "#test-support/postgres.ts";
import { holdJob } from "./holdJob.ts";
import { notesHttp } from "./http.ts";

export const notesDeployment = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: () => ({}),
	layer: postgres,
	name: "notes deployment",
	stages: [],
	verbs: (_engine, story) => ({
		...deploymentProcesses(story.tell),
		heartbeatWindowPasses: () => {
			story.tell("the worker remains draining beyond the heartbeat staleness window");
			return Effect.sleep("6 seconds");
		},
		holdJob,
		notesAt: notesHttp,
		workerPollPasses: () => {
			story.tell("a worker polling interval passes");
			return Effect.sleep("1200 millis");
		},
	}),
});
