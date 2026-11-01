import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { deployment } from "#test-support/deployment.ts";

const WAITING = [expect.stringContaining("Waiting for database migrations")];

deployment.it(
	"before migrations, the web process refuses to start without reporting a schema mismatch",
	[],
	function* ({ logLines, webStartAnswer }) {
		const started = yield* webStartAnswer();

		yield* outcomes([
			["web start", () => Effect.succeed(started), "refused: database migrations are not current"],
			["schema mismatch reports", () => logLines("web", /Database schema mismatch/v), []],
		]);
	},
);

deployment.it(
	"before migrations, a worker waits for them and keeps running",
	[],
	function* ({ logLines, migrationLedger, processState, workerStartsWaiting }) {
		expect(yield* migrationLedger()).toBe("missing");

		yield* workerStartsWaiting("current");

		yield* outcomes([
			["worker", () => processState("current worker"), "running"],
			["worker's migration lines", () => logLines("current worker", /migrations/v), WAITING],
		]);
	},
);

deployment.it(
	"while a migration waits on the schema lock, its ledger exists and the waiting worker keeps waiting",
	[],
	function* ({
		logLines,
		migrationBlocksOnTheSchemaLock,
		migrationLedger,
		processState,
		schemaCreationIsHeld,
		startsMigrating,
		workerStartsWaiting,
	}) {
		yield* workerStartsWaiting("current");
		yield* schemaCreationIsHeld();

		yield* startsMigrating("current");
		yield* migrationBlocksOnTheSchemaLock();

		yield* outcomes([
			["migration ledger", () => migrationLedger(), "app_migrations"],
			["worker", () => processState("current worker"), "running"],
			["worker's migration lines", () => logLines("current worker", /migrations/v), WAITING],
		]);
	},
	60_000,
);

deployment.it(
	"once the held migration finishes, the waiting worker becomes ready",
	[],
	function* ({
		logLines,
		migrationBlocksOnTheSchemaLock,
		migrationFinishes,
		schemaCreationIsHeld,
		schemaLockIsReleased,
		startsMigrating,
		workerBecomesReady,
		workerStartsWaiting,
	}) {
		yield* workerStartsWaiting("current");
		yield* schemaCreationIsHeld();
		yield* startsMigrating("current");
		yield* migrationBlocksOnTheSchemaLock();

		yield* schemaLockIsReleased();

		yield* outcomes([
			["migration", () => migrationFinishes("current"), "migrated"],
			["worker", () => workerBecomesReady("current"), "ready"],
			[
				"worker's startup lines",
				() => logLines("current worker", /migrations|Worker /v),
				[
					expect.stringContaining("Waiting for database migrations"),
					expect.stringContaining("Database migrations current"),
					expect.stringContaining("Worker ready to take jobs"),
				],
			],
		]);
	},
	60_000,
);

deployment.it(
	"after migration, the web process starts healthy, signs up alice and loads Node's HTTP server without a Redis client",
	[],
	function* ({ health, loadedModules, logLines, migrates, signsUpOverHttp, webStarts }) {
		yield* migrates("current");

		yield* webStarts();

		yield* outcomes([
			["health", () => health(), "healthy"],
			["alice's sign-up", () => signsUpOverHttp("alice"), "signed up with a session"],
			["HTTP server modules", () => loadedModules("web", /\/NodeHttpServer\.[jt]s$/v), [expect.stringMatching(/^NodeHttpServer\.[jt]s$/v)]],
			["Redis modules", () => loadedModules("web", /\/(?:redis|@redis)[\/@]/v), []],
			["schema mismatch reports", () => logLines("web", /Database schema mismatch/v), []],
		]);
	},
	60_000,
);

deployment.it(
	"a healthy app on the requested port cannot make a web process with a missing schema ready",
	[],
	function* ({ anotherAppListens, webStartAnswer }) {
		const port = yield* anotherAppListens();

		const started = yield* webStartAnswer(port);

		expect(started).toBe("refused: database migrations are not current");
	},
);
