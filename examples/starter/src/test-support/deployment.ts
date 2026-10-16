import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/database.ts";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { deployChild, deployPort } from "./deployChild.ts";
import { postgres } from "./postgres.ts";

export const deployment = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: () => ({}),
	layer: postgres,
	name: "deployment",
	stages: ["schema"],
	verbs: (_engine, story) => ({
		migrate: Effect.fn("DeploymentStory.migrate")(function* () {
			story.tell("run the secret-free deployment migration command");
			const database = yield* PostgresTestDatabase;
			const migration = yield* deployChild("migrate", database.url).pipe(Effect.provide(NodeServices.layer));
			const code = yield* migration.child.exitCode;
			story.tell([...migration.logs, ...migration.errors].join("\n"));
			return code;
		}),
		port: Effect.promise(deployPort),
		startProcess: Effect.fn("DeploymentStory.startProcess")(function* (kind: "worker" | "web", port = 0) {
			story.tell(`start the ${kind} process`);
			const database = yield* PostgresTestDatabase;
			return yield* deployChild(kind, database.url, port).pipe(Effect.provide(NodeServices.layer));
		}),
	}),
});
