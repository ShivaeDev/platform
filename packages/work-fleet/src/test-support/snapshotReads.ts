import { Effect, Exit, Tracer } from "effect";
import { SqlClient } from "effect/sql";
import { TestClock } from "effect/testing";
import type { FleetHost } from "#host/config.ts";
import { type HostFixture, withHost } from "#test/fleetHost.ts";
import { hostDatabase } from "#test/hostDatabase.ts";
import { withReadDaemon } from "#test/readDaemon.ts";
import { storeState } from "#test/storeState.ts";

// Effect SQL records every executed statement as a span with its query text and exit, so the daemon's reads are counted where they run.
export function snapshotReads(host: FleetHost) {
	const spans: Tracer.NativeSpan[] = [];
	const tracer = Tracer.make({
		span: (options) => {
			const span = new Tracer.NativeSpan(options);
			spans.push(span);
			return span;
		},
	});
	function statements() {
		return spans.flatMap((span) => {
			const text = span.attributes.get("db.query.text");
			return typeof text === "string" ? [text] : [];
		});
	}
	function snapshots() {
		return spans.filter((span) => {
			const text = span.attributes.get("db.query.text");
			return typeof text === "string" && text.includes('"checks"') && !text.includes('"history"') && text.includes(`${host.namespace}_records`);
		});
	}
	let broken = false;
	// The rename runs outside the test's transaction so the daemon sees it.
	const rename = Effect.fn("SnapshotTest.rename")(
		function* (from: string, to: string, nowBroken: boolean) {
			const sql = yield* SqlClient.SqlClient;
			yield* sql.unsafe(`alter table "${host.namespace}_records" rename column ${from} to ${to}`);
			broken = nowBroken;
		},
		Effect.provide(hostDatabase(host, "work-fleet-snapshot", 1)),
		Effect.orDie,
	);
	const restoreReads = rename("unavailable_stage", "stage", false);
	return {
		breakReads: rename("stage", "unavailable_stage", true),
		count: () => snapshots().length,
		failedCount: () => snapshots().filter((span) => span.status._tag === "Ended" && Exit.isFailure(span.status.exit)).length,
		observe: <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.withTracer(effect, tracer),
		restoreIfBroken: Effect.suspend(() => (broken ? restoreReads : Effect.void)),
		restoreReads,
		statements,
	};
}

export type SnapshotReads = ReturnType<typeof snapshotReads>;

export const untilReads = Effect.fn("SnapshotTest.untilReads")(function* (reads: { readonly count: () => number }, count: number) {
	for (let attempt = 0; attempt < 1000; attempt += 1) {
		if (reads.count() >= count) {
			return;
		}
		yield* Effect.sleep("10 millis");
	}
	return yield* Effect.die(new Error(`Expected ${count} snapshot reads, got ${reads.count()}`));
});

function advanceWhile<A, E, R>(clock: TestClock.TestClock, effect: Effect.Effect<A, E, R>) {
	return Effect.raceFirst(effect, Effect.forever(clock.adjust("500 millis").pipe(Effect.andThen(Effect.sleep("10 millis")))));
}

export interface SnapshotDaemon {
	readonly advancing: <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, R>;
	readonly clock: TestClock.TestClock;
	readonly delivered: () => number;
	readonly port: number;
	readonly reads: SnapshotReads;
}

export function withSnapshotDaemon<A, E, R>(use: (fixture: HostFixture, daemon: SnapshotDaemon) => Effect.Effect<A, E, R>) {
	return withHost({}, {}, (fixture) =>
		Effect.gen(function* () {
			yield* storeState(fixture.host, "one", { stage: "executing" });
			yield* storeState(fixture.host, "marker", { stage: "released" });
			const reads = snapshotReads(fixture.host);
			const clock = yield* TestClock.make();
			let delivered = 0;
			function onSnapshot() {
				delivered += 1;
			}
			function daemon(port: number) {
				return use(fixture, { advancing: (effect) => advanceWhile(clock, effect), clock, delivered: () => delivered, port, reads });
			}
			return yield* reads
				.observe(withReadDaemon(fixture.host, daemon, { handlerClock: clock, onSnapshot, parts: fixture.parts }))
				.pipe(Effect.ensuring(reads.restoreIfBroken));
		}).pipe(Effect.scoped),
	);
}
