import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { deployChild, deployPort } from "#test-support/deployChild.ts";
import { postgres } from "#test-support/postgres.ts";
import { deploymentProcesses } from "./deploymentProcesses.ts";
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
		migrate: Effect.fn("DeploymentStory.migrate")(function* () {
			story.tell("run the secret-free deployment migration command");
			const database = yield* PostgresTestDatabase;
			const migration = yield* deployChild("migrate", database.url).pipe(Effect.provide(NodeServices.layer));
			const code = yield* migration.child.exitCode;
			story.tell([...migration.logs, ...migration.errors].join("\n"));
			return code;
		}),
		migrationTable,
		port: Effect.promise(deployPort),
	}),
});
