import { Cause, Effect, Exit, Fiber, Result } from "effect";
import { Migrator } from "effect/sql";
import { SqlError } from "effect/sql/SqlError";
import { expect } from "vitest";
import { eventually } from "@shivaedev/test/eventually.ts";
import { withLive } from "@shivaedev/test/withLive.ts";
import { invalidLedger, migrationHost } from "#test/app-host/migrationStory.ts";
import { pendingJobsSchema } from "#test/app-host/withJobsSchema.ts";

for (const ledger of ["missing", "pending"] as const) {
	migrationHost.it(`starts after another process applies a migration with a ${ledger} ledger`, [], function* ({ start, migrate, lifecycle }) {
		if (ledger === "pending") {
			expect(yield* migrate(true)).toBe(0);
		}
		const host = yield* start();
		expect(yield* host.next).toEqual({ _tag: "Sleeping", millis: 10 });
		expect(lifecycle()).toEqual([]);
		expect(yield* migrate()).toBe(0);
		yield* host.advance("10 millis");
		expect(yield* host.ping).toBe("pong");
		expect(lifecycle()).toEqual(["started"]);
		expect(host.migrationLogs().map((entry) => entry.message)).toEqual([["Waiting for database migrations"], ["Database migrations current"]]);
	});
}

migrationHost.it("times out with the same MigrationError as check when the polling budget expires", [], function* ({ start, migrate, lifecycle }) {
	expect(yield* migrate(true)).toBe(0);
	const checked = yield* start({ mode: "check" });
	const checkExit = yield* checked.exit;
	expect(Exit.isFailure(checkExit)).toBe(true);
	const host = yield* start({ waitTimeout: "25 millis" });
	for (const millis of [10, 10, 10]) {
		expect(yield* host.next).toEqual({ _tag: "Sleeping", millis });
		yield* host.advance(millis);
	}
	const exit = yield* host.exit;
	expect(host.recordedEvents().slice(-2)).toEqual([["Timed out waiting for database migrations"], exit]);
	expect(Exit.isFailure(exit)).toBe(true);
	expect(host.migrationLogs().map((entry) => entry.message)).toEqual([
		["Waiting for database migrations"],
		["Timed out waiting for database migrations"],
	]);
	expect(host.migrationLogs().at(-1)).toEqual({
		annotations: {
			pendingComponents: [],
			pendingMigrations: [{ id: 2, name: "ready" }],
		},
		level: "Info",
		message: ["Timed out waiting for database migrations"],
	});
	if (Exit.isFailure(exit) && Exit.isFailure(checkExit)) {
		const failure = Cause.findError(exit.cause);
		const checkFailure = Cause.findError(checkExit.cause);
		expect(Result.isSuccess(failure) && failure.success).toBeInstanceOf(Migrator.MigrationError);
		expect(failure).toEqual(checkFailure);
	}
	expect(lifecycle()).toEqual([]);
});

migrationHost.it("starts at once when the ledger is current", [], function* ({ start, migrate, lifecycle }) {
	expect(yield* migrate()).toBe(0);
	const host = yield* start();
	expect(yield* host.next).toEqual({ _tag: "Ready" });
	expect(yield* host.ping).toBe("pong");
	expect(lifecycle()).toEqual(["started"]);
	yield* host.interrupt;
	expect(lifecycle()).toEqual(["started", "closed"]);
	expect(host.migrationLogs()).toEqual([]);
});

migrationHost.it("preserves SQL failures immediately instead of waiting for schema readiness", [invalidLedger], function* ({ start, lifecycle }) {
	const host = yield* start();
	expect(yield* host.next).toMatchObject({ _tag: "Exited", exit: { _tag: "Failure" } });
	const exit = yield* host.exit;
	if (Exit.isFailure(exit)) {
		const failure = Cause.findError(exit.cause);
		expect(Result.isSuccess(failure) && failure.success).toBeInstanceOf(SqlError);
	}
	expect(lifecycle()).toEqual([]);
});

migrationHost.it(
	"interruption stops waiting and closes the database pool without starting the application",
	[],
	function* ({ start, connections, lifecycle, holdDisconnects }) {
		const disconnects = yield* holdDisconnects();
		const shutdown = yield* Effect.gen(function* () {
			const host = yield* start();
			expect(yield* host.next).toEqual({ _tag: "Sleeping", millis: 10 });
			expect(yield* connections()).toEqual([{ state: "idle" }]);
			const pending = yield* host.interrupt.pipe(Effect.forkChild);
			yield* disconnects.disconnecting;
			expect(pending.pollUnsafe()).toBeUndefined();
			return { host, pending };
		}).pipe(Effect.ensuring(disconnects.release));
		yield* Fiber.join(shutdown.pending);
		const exit = yield* shutdown.host.exit;
		expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(true);
		yield* withLive(eventually(connections().pipe(Effect.flatMap((rows) => Effect.try(() => expect(rows).toEqual([]))))));
		expect(lifecycle()).toEqual([]);
	},
);

migrationHost.it(
	"logs pending ledger IDs and pg-boss on a fixed progress interval independent of polling",
	[pendingJobsSchema],
	function* ({ start, migrate }) {
		const host = yield* start({ pollInterval: "1 second", progressInterval: "25 millis" });
		expect(yield* host.next).toEqual({ _tag: "Sleeping", millis: 1000 });
		expect(host.migrationLogs()).toEqual([
			{
				annotations: {
					pendingComponents: [
						{
							detail: expect.stringMatching(/installed version missing, required version \d+$/u),
							name: expect.stringMatching(/^pg-boss:waiting_[a-f0-9]+_jobs$/u),
						},
					],
					pendingMigrations: [
						{ id: 1, name: "initial" },
						{ id: 2, name: "ready" },
					],
				},
				level: "Info",
				message: ["Waiting for database migrations"],
			},
		]);
		yield* host.advance("24 millis");
		expect(host.migrationLogs().map((entry) => entry.message)).toEqual([["Waiting for database migrations"]]);
		yield* host.advance("1 milli");
		expect(host.migrationLogs()).toEqual([
			host.migrationLogs()[0],
			{ ...host.migrationLogs()[0], message: ["Still waiting for database migrations"] },
		]);
		expect(yield* migrate()).toBe(0);
		yield* host.advance("975 millis");
		expect(yield* host.ping).toBe("pong");
		expect(host.migrationLogs().at(-1)).toMatchObject({ level: "Info", message: ["Database migrations current"] });
		yield* host.interrupt;
		expect(host.migrationLogs().filter((entry) => entry.message.includes("Database migrations current"))).toEqual([
			{ annotations: {}, level: "Info", message: ["Database migrations current"] },
		]);
	},
);
