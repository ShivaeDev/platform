import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/database.ts";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { deployChild, deployPort } from "#test-support/deployChild.ts";
import { postgres } from "#test-support/postgres.ts";
import { deploymentProcesses } from "./deploymentProcesses.ts";
import { deploymentSchema } from "./deploymentSchema.ts";
import { storedNotes } from "./storedNotes.ts";

export const deployment = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: () => ({}),
	layer: postgres,
	name: "deployment",
	stages: ["schema"],
	verbs: (_engine, story) => ({
		...deploymentProcesses(story.tell),
		...deploymentSchema(story.tell),
		...storedNotes(story.tell),
		migrate: Effect.fn("DeploymentStory.migrate")(function* () {
			story.tell("run the secret-free deployment migration command");
			const database = yield* PostgresTestDatabase;
			const migration = yield* deployChild("migrate", database.url).pipe(Effect.provide(NodeServices.layer));
			const code = yield* migration.child.exitCode;
			story.tell([...migration.logs, ...migration.errors].join("\n"));
			return code;
		}),
		port: Effect.promise(deployPort),
	}),
});

export function conflictingNotesTable() {
	return deployment.trait("schema", "an existing notes table conflicts with the first migration", function* () {
		const sql = yield* SqlClient.SqlClient;
		yield* sql`create table notes (title text)`;
	});
}
