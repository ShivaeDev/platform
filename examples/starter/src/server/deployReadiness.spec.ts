import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { deployment } from "#test-support/deployment.ts";

deployment.it(
	"web rejects a missing schema while an already-started worker waits for deployment migration",
	[],
	function* ({ startProcess, holdSchemaCreation, health, signUpAt, migrationTable }) {
		const prematureWeb = yield* startProcess("web");
		expect(yield* prematureWeb.exitCode).not.toBe(0);
		expect([...prematureWeb.logs, ...prematureWeb.errors].join("\n")).toContain("Database migrations are not current");
		expect([...prematureWeb.logs, ...prematureWeb.errors].join("\n")).not.toContain("Database schema mismatch");
		const failure = yield* prematureWeb.ready.pipe(Effect.flip);
		expect(failure.message).toContain("Database migrations are not current");
		const worker = yield* startProcess("worker");
		yield* worker.waitingForSchema;
		expect(yield* worker.child.isRunning).toBe(true);
		expect(worker.logs.filter((line) => line.includes("migrations"))).toEqual([expect.stringContaining("Waiting for database migrations")]);
		expect(yield* migrationTable).toEqual([{ ledger: null }]);
		const schemaCreation = yield* holdSchemaCreation;
		const migration = yield* Effect.gen(function* () {
			const pending = yield* startProcess("migrate");
			yield* schemaCreation.migrationBlocked;
			expect(yield* migrationTable).toEqual([{ ledger: "app_migrations" }]);
			expect(worker.logs.filter((line) => line.includes("migrations"))).toEqual([expect.stringContaining("Waiting for database migrations")]);
			expect(yield* worker.child.isRunning).toBe(true);
			return pending;
		}).pipe(Effect.ensuring(schemaCreation.release));
		yield* outcomes({
			"migration exit code": [migration.exitCode, 0],
			"worker readiness": [worker.ready, "worker"],
		});
		const web = yield* startProcess("web");
		const address = yield* web.ready;
		expect(web.logs).toContainEqual(expect.stringMatching(/Loaded module: .*\/NodeHttpServer\.[jt]s$/v));
		expect(web.logs.filter((line) => /Loaded module: .*\/(?:redis|@redis)[\/@]/v.test(line))).toEqual([]);
		expect((yield* health(address)).status).toBe(HttpStatus.fromLiteral("OK"));
		const signup = yield* signUpAt(address, "deploy");
		expect(signup.status).toBe(HttpStatus.fromLiteral("OK"));
		expect(signup.cookie).toContain("session_token=");
		expect([...web.logs, ...web.errors].join("\n")).not.toContain("Database schema mismatch");
		expect(worker.logs.filter((line) => line.includes("migrations") || line.includes("Worker "))).toEqual([
			expect.stringContaining("Waiting for database migrations"),
			expect.stringContaining("Database migrations current"),
			expect.stringContaining("Worker ready to take jobs"),
		]);
		yield* outcomes({
			"web keeps running": [web.child.isRunning, true],
			"worker keeps running": [worker.child.isRunning, true],
		});
	},
	4 * 20_000 + 40_000,
);

deployment.it(
	"a healthy app on the requested port cannot make a web process with a missing schema ready",
	[],
	function* ({ startOtherApplication, startProcess, health }) {
		const other = yield* startOtherApplication;
		expect((yield* health(other.address)).status).toBe(HttpStatus.fromLiteral("OK"));

		const web = yield* startProcess("web", other.port);
		const failure = yield* web.ready.pipe(Effect.flip);

		expect(failure.message).toContain("Database migrations are not current");
		expect(yield* web.exitCode).not.toBe(0);
	},
);
