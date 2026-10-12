import { vi } from "@effect/vitest";
import { Effect } from "effect";
import pg from "pg";
import type { FleetHost } from "#host/config.ts";
import { type HostFixture, storeState, withHost } from "#test/fleetHost.ts";
import { withReadDaemon } from "#test/readDaemon.ts";

export const snapshotReads = Effect.fn("SnapshotTest.snapshotReads")(function* (host: FleetHost) {
	const query = pg.Client.prototype.query;
	let failures = 0;
	function isSnapshot(text: unknown): boolean {
		return typeof text === "string" && text.includes('"checks"') && !text.includes('"history"') && text.includes(`${host.namespace}_records`);
	}
	const queries = vi.spyOn(pg.Client.prototype, "query").mockImplementation(function (this: pg.Client, ...args) {
		const [text, values, callback] = args;
		if (isSnapshot(text) && typeof callback === "function") {
			return query.call(this, text, values, (error, result) => {
				if (error) {
					failures += 1;
				}
				callback(error, result);
			});
		}
		return query.apply(this, args);
	});
	const control = new pg.Pool({ connectionString: host.databaseUrl });
	let broken = false;
	function rename(from: string, to: string) {
		return Effect.promise(() => control.query(`alter table "${host.namespace}_records" rename column ${from} to ${to}`));
	}
	yield* Effect.addFinalizer(() =>
		Effect.gen(function* () {
			if (broken) {
				yield* rename("unavailable_stage", "stage");
			}
			yield* Effect.promise(() => control.end());
			queries.mockRestore();
		}),
	);
	return {
		breakReads: rename("stage", "unavailable_stage").pipe(
			Effect.tap(() =>
				Effect.sync(() => {
					broken = true;
				}),
			),
		),
		count: () => queries.mock.calls.filter(([text]) => isSnapshot(text)).length,
		failedCount: () => failures,
		restoreReads: rename("unavailable_stage", "stage").pipe(
			Effect.tap(() =>
				Effect.sync(() => {
					broken = false;
				}),
			),
		),
	};
});

export const untilReads = Effect.fn("SnapshotTest.untilReads")(function* (reads: { readonly count: () => number }, count: number) {
	for (let attempt = 0; attempt < 1000; attempt += 1) {
		if (reads.count() >= count) {
			return;
		}
		yield* Effect.sleep("10 millis");
	}
	return yield* Effect.die(new Error(`Expected ${count} snapshot reads, got ${reads.count()}`));
});

export function withSnapshotDaemon<A, E, R>(
	use: (fixture: HostFixture, port: number, reads: Effect.Success<ReturnType<typeof snapshotReads>>) => Effect.Effect<A, E, R>,
) {
	return withHost({}, {}, (fixture) =>
		Effect.scoped(
			Effect.gen(function* () {
				yield* storeState(fixture.host, "one", { stage: "executing" });
				yield* storeState(fixture.host, "marker", { stage: "released" });
				const reads = yield* snapshotReads(fixture.host);
				return yield* withReadDaemon(fixture.host, (port) => use(fixture, port, reads), fixture.parts);
			}),
		),
	);
}
