import { Cause, Effect, Exit, Fiber, Result } from "effect";
import { Migrator } from "effect/sql";
import { SqlError } from "effect/sql/SqlError";
import { expect } from "vitest";
import { eventually } from "@shivaedev/effect-test/eventually.ts";
import { withLive } from "@shivaedev/effect-test/withLive.ts";
import { invalidLedger, migrationHost } from "#test/app-host/migrationStory.ts";

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
	});
}

migrationHost.it("times out with the same MigrationError as check when the polling budget expires", [], function* ({ start, lifecycle }) {
	const checked = yield* start({ mode: "check" });
	const checkExit = yield* checked.exit;
	expect(Exit.isFailure(checkExit)).toBe(true);
	const host = yield* start({ waitTimeout: "25 millis" });
	for (const millis of [10, 10, 10]) {
		expect(yield* host.next).toEqual({ _tag: "Sleeping", millis });
		yield* host.advance(millis);
	}
	const exit = yield* host.exit;
	expect(Exit.isFailure(exit)).toBe(true);
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
			expect(yield* connections()).toBe(1);
			const pending = yield* host.interrupt.pipe(Effect.forkChild);
			yield* disconnects.disconnecting;
			expect(pending.pollUnsafe()).toBeUndefined();
			return { host, pending };
		}).pipe(Effect.ensuring(disconnects.release));
		yield* Fiber.join(shutdown.pending);
		const exit = yield* shutdown.host.exit;
		expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(true);
		yield* withLive(eventually(connections().pipe(Effect.flatMap((count) => Effect.try(() => expect(count).toBe(0))))));
		expect(lifecycle()).toEqual([]);
	},
);
