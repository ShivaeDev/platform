import { Cause, Exit, Result } from "effect";
import { Migrator } from "effect/sql";
import { expect } from "vitest";
import { migrationHost } from "#test/app-host/migrationStory.ts";

migrationHost.it("web checks serve requests without requiring the configured release marker", [], function* ({ start, migrate, lifecycle }) {
	expect(yield* migrate()).toBe(0);
	const host = yield* start({ mode: "check", release: "unrecorded" });
	expect(yield* host.next).toEqual({ _tag: "Ready" });
	expect(yield* host.ping).toBe("pong");
	expect(lifecycle()).toEqual(["started"]);
	expect(host.migrationLogs()).toEqual([]);
});

migrationHost.it("bounds startup waiting for a release marker by the migration polling budget", [], function* ({ start, migrate, lifecycle }) {
	expect(yield* migrate()).toBe(0);
	const host = yield* start({ release: "next", waitTimeout: "25 millis" });
	for (const millis of [10, 10, 10]) {
		expect(yield* host.next).toEqual({ _tag: "Sleeping", millis });
		yield* host.advance(millis);
	}
	const exit = yield* host.exit;
	expect(Exit.isFailure(exit)).toBe(true);
	if (Exit.isFailure(exit)) {
		const failure = Cause.findError(exit.cause);
		expect(Result.isSuccess(failure) && failure.success).toBeInstanceOf(Migrator.MigrationError);
	}
	expect(host.migrationLogs().at(-1)).toEqual({
		annotations: { pendingComponents: [{ detail: "Expected release next; recorded none", name: "database release" }], pendingMigrations: [] },
		level: "Info",
		message: ["Timed out waiting for database migrations"],
	});
	expect(lifecycle()).toEqual([]);
});
