import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { deploymentProcesses } from "#test-support/deploymentProcesses.ts";
import { postgres } from "#test-support/postgres.ts";
import { notesHttp } from "./http.ts";

export const notesDeployment = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: () => ({}),
	layer: postgres,
	name: "notes deployment",
	stages: [],
	verbs: (_engine, story) => ({ ...deploymentProcesses(story.tell), notesAt: notesHttp }),
});
