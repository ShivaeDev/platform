import { Effect } from "effect";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { notesHttp } from "#modules/notes/test-support/http.ts";
import { deployPort } from "#test-support/deployChild.ts";
import { postgres } from "#test-support/postgres.ts";
import { deploymentProcesses } from "./deploymentProcesses.ts";
import { holdNoteJob } from "./holdNoteJob.ts";
import { holdSchemaCreation } from "./holdSchemaCreation.ts";
import { migrationTable } from "./migrationTable.ts";

export const deployment = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: () => ({}),
	layer: postgres,
	name: "deployment",
	stages: ["schema"],
	verbs: (_engine, story) => ({
		...deploymentProcesses(story.tell),
		holdNoteJob,
		holdSchemaCreation,
		migrationTable,
		notesAt: notesHttp,
		port: Effect.promise(deployPort),
	}),
});
