import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { postgres } from "#test-support/postgres.ts";
import { type DeploymentEngine, deploymentEngine, deploymentVerbs } from "./deploymentProcesses.ts";
import { holdSchemaCreation } from "./holdSchemaCreation.ts";
import { startHost } from "./host.ts";

interface DeploymentStoryEngine extends DeploymentEngine {
	schemaLock: Effect.Success<typeof holdSchemaCreation> | undefined;
}

export const deployment = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: (): DeploymentStoryEngine => ({ ...deploymentEngine(), schemaLock: undefined }),
	inspect: ({ address, processes }) => ({ address, processes: [...processes.keys()] }),
	layer: postgres,
	name: "deployment",
	stages: [],
	verbs: (engine, story) => ({
		...deploymentVerbs(engine, story.tell),
		anotherAppListens: Effect.fn("DeploymentStory.anotherAppListens")(function* () {
			story.tell("another app with its own database listens on a port");
			const database = yield* PostgresTestDatabase;
			const services = yield* database.isolated;
			const host = yield* startHost().pipe(Effect.provideContext(services));
			return Number(new URL(host.baseUrl).port);
		}),
		migrationBlocksOnTheSchemaLock: () => {
			story.tell("the migration waits on the schema lock");
			if (engine.schemaLock === undefined) {
				throw new Error("No schema lock is held; call schemaCreationIsHeld() first");
			}
			return engine.schemaLock.migrationBlocked;
		},
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
