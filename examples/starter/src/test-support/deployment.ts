import { Clock, DateTime, Duration, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { storyDatabase } from "@shivaedev/test-sql/server/storyDatabase.ts";
import { waitForBlockedSessions } from "@shivaedev/test-sql/server/waitForBlockedSessions.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { type DeploymentEngine, deploymentControls, deploymentEngine, deploymentVerbs } from "#test-support/deploymentProcesses.ts";
import { holdSchemaCreation } from "#test-support/holdSchemaCreation.ts";
import { startHost } from "#test-support/host.ts";
import { configured, postgres } from "#test-support/postgres.ts";

interface DeploymentStoryEngine extends DeploymentEngine {
	readonly database: Effect.Success<ReturnType<typeof storyDatabase>>;
	schemaLock: Effect.Success<typeof holdSchemaCreation> | undefined;
}

export const deployment = storyKit({
	after: { database: (engine) => engine.database.acquire },
	clock: Effect.runSync(DateTime.now),
	*create() {
		const engine: DeploymentStoryEngine = {
			...deploymentEngine(yield* Clock.currentTimeMillis),
			database: yield* storyDatabase(),
			schemaLock: undefined,
		};
		return engine;
	},
	inspect: ({ address, processes }) => ({ address, processes: [...processes.keys()] }),
	layer: postgres,
	name: "deployment",
	runIf: configured,
	stages: ["database"],
	verbs: (engine, story) => ({
		...deploymentVerbs(engine, story.tell),
		anotherAppListens: Effect.fn("DeploymentStory.anotherAppListens")(function* () {
			story.tell("another app with its own database listens on a port");
			const database = yield* PostgresTestDatabase;
			const services = yield* database.isolated;
			const host = yield* startHost().pipe(Effect.provideContext(services));
			return Number(new URL(host.baseUrl).port);
		}),
		migrationBlocksOnTheSchemaLock: Effect.fn("DeploymentStory.migrationBlocksOnTheSchemaLock")(function* (release: string) {
			story.tell("the migration waits on the schema lock");
			if (engine.schemaLock === undefined) {
				return yield* Effect.die("No schema lock is held; call schemaCreationIsHeld() first");
			}
			const migration = deploymentControls(engine).processOf(`${release} migration`);
			const exited = migration.exitCode.pipe(
				Effect.flatMap((code) =>
					Effect.die(
						`The ${release} migration exited with code ${code} before it waited on the schema lock\n${[...migration.logs, ...migration.errors].join("\n")}`,
					),
				),
			);
			// Starting the migration's process takes as long as the machine allows, so the wait ends when the migration exits, at the latest
			// after its own lock timeout, rather than at a deadline.
			yield* waitForBlockedSessions(engine.schemaLock.holder, { within: Duration.infinity }).pipe(Effect.raceFirst(exited));
		}),
		migrationLedger: Effect.fn("DeploymentStory.migrationLedger")(function* () {
			const sql = yield* SqlClient.SqlClient;
			const [row] = yield* sql<{ ledger: string | null }>`select to_regclass('app_migrations')::text as ledger`;
			return row?.ledger ?? "missing";
		}),
		schemaCreationIsHeld: Effect.fn("DeploymentStory.schemaCreationIsHeld")(function* () {
			story.tell("another session takes the lock that schema creation needs");
			engine.schemaLock = yield* holdSchemaCreation;
		}),
		schemaLockIsReleased: () => {
			story.tell("the schema lock is released");
			if (engine.schemaLock === undefined) {
				throw new Error("No schema lock is held; call schemaCreationIsHeld() first");
			}
			return engine.schemaLock.release;
		},
	}),
});

export const emptyDatabase = deployment.trait("database", "the story starts before migrations, from an empty database", (engine) => {
	engine.database.select("empty");
});
