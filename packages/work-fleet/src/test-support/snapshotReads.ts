import { Effect, Exit, Tracer } from "effect";
import { SqlClient } from "effect/sql";
import type { FleetHost } from "#host/config.ts";
import { hostDatabase } from "#test/hostDatabase.ts";

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
	function statements(traceId?: string) {
		return spans.flatMap((span) => {
			if (traceId !== undefined && span.traceId !== traceId) {
				return [];
			}
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
		queries: () =>
			snapshots().map((span) => ({
				failed: span.status._tag === "Ended" && Exit.isFailure(span.status.exit),
				text: span.attributes.get("db.query.text"),
			})),
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
