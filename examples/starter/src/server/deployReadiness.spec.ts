import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { deployment } from "#test-support/deployment.ts";

deployment.it(
	"web rejects a missing schema while an already-started worker waits for deployment migration",
	[],
	function* ({ startProcess, holdSchemaCreation, health, signUpAt, port: availablePort, migrationTable }) {
		const port = yield* availablePort;
		const prematureWeb = yield* startProcess("web", port);
		expect(yield* prematureWeb.child.exitCode).not.toBe(0);
		expect([...prematureWeb.logs, ...prematureWeb.errors].join("\n")).toContain("Database migrations are not current");
		expect([...prematureWeb.logs, ...prematureWeb.errors].join("\n")).not.toContain("Database schema mismatch");
		yield* Effect.promise(() => expect(fetch(`http://127.0.0.1:${port}/health`)).rejects.toThrow());
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
		expect(yield* migration.child.exitCode, [...migration.logs, ...migration.errors].join("\n")).toBe(0);
		expect(yield* worker.ready).toBe("worker");
		const web = yield* startProcess("web", port);
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
		expect(yield* worker.child.isRunning).toBe(true);
		expect(yield* web.child.isRunning).toBe(true);
	},
	120_000,
);
