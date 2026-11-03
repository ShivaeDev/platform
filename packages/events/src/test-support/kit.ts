import { Effect, Queue, type Schema } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import type { SqlError } from "effect/sql/SqlError";
import { readKeys } from "@shivaedev/changes/keys.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { AlreadyDone, StreamConflict, UnsupportedEventVersion } from "#errors.ts";
import { holdEarlyCommit, outcome, raceRebuildAndCatchUp, writersRace } from "./concurrency.ts";
import { configured, database } from "./database.ts";
import { noteEngine, notes } from "./notes.ts";

const create = Effect.gen(function* () {
	const engine = yield* noteEngine;
	const storedRows = engine.rows
		.findMany({ orderBy: { direction: "asc", field: "id" } })
		.pipe(Effect.map((rows) => rows.map(({ name, stream }) => ({ name, stream }))));
	const live = yield* Reactivity.query(storedRows, readKeys([notes.list]));
	const release: { early: Effect.Effect<void, AlreadyDone | StreamConflict | UnsupportedEventVersion | SqlError | Schema.SchemaError> } = {
		early: Effect.void,
	};
	return { ...engine, live, release, storedRows };
});

export const events = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: () => create,
	layer: database,
	name: "Event history",
	runIf: configured,
	stages: ["history"],
	verbs: (engine) => ({
		append: (requestId: string, names: readonly [string, ...string[]], expectedVersion = 0, stream = "alice") =>
			outcome(
				engine.store.append({ events: [{ name: names[0] }, ...names.slice(1).map((name) => ({ name }))], expectedVersion, requestId, stream }),
			).pipe(Effect.catchTag("ProjectionRejected", () => Effect.succeed("projection rejected"))),
		appendCount: (count: bigint) => engine.counts.append({ events: [{ count }], expectedVersion: 0, requestId: "count", stream: "counter" }),
		appendWithAudit: () =>
			engine.combined.append({ events: [{ name: "Draft" }, { name: "Published" }], expectedVersion: 0, requestId: "batch", stream: "alice" }),
		catchUp: () => engine.store.catchUp,
		catchUpAudit: () => engine.auditStore.catchUp,
		commitEarlyWriter: () => engine.release.early,
		eraseRows: () => engine.rows.delete({}),
		history: (stream = "alice") => engine.store.read(stream).pipe(Effect.map((entries) => entries.map(({ value }) => value))),
		liveRows: () => Queue.take(engine.live).pipe(Effect.timeout("5 seconds")),
		raceRebuildAndCatchUp: () => raceRebuildAndCatchUp(engine),
		rebuild: () => engine.store.rebuild.pipe(Effect.catchTag("ProjectionRejected", () => Effect.succeed("projection rejected"))),
		rebuildCombined: () => engine.combined.rebuild,
		rebuildUpgraded: () => engine.upgraded.rebuild,
		rebuildWithoutUpcaster: () =>
			engine.store.rebuild.pipe(
				Effect.catchTag("UnsupportedEventVersion", (error) =>
					Effect.succeed(`unsupported version ${error.storedVersion}, current ${error.currentVersion}`),
				),
			),
		storedAudit: () => engine.audit.findMany().pipe(Effect.map((rows) => rows.map(({ name }) => name))),
		storedCounts: () => engine.counts.read("counter").pipe(Effect.map((entries) => entries.map(({ value }) => value.count))),
		storedRows: () => engine.storedRows,
		writersRace: (repeated = false) => writersRace(engine, repeated),
	}),
});

export function saved(requestId: string, name: string, expectedVersion = 0) {
	return events.trait("history", `${name} was recorded for alice`, (engine) =>
		engine.store.append({ events: [{ name }], expectedVersion, requestId, stream: "alice" }).pipe(Effect.asVoid),
	);
}

export const legacySaved = events.trait("history", "alice's title was recorded with the old event schema", (engine) =>
	engine.legacy.append({ events: [{ title: "Original" }], expectedVersion: 0, requestId: "old", stream: "alice" }).pipe(Effect.asVoid),
);

export const earlyWriterHeld = events.trait("history", "alpha's event is appended but its transaction has not committed", function* (engine) {
	const release = yield* holdEarlyCommit(engine);
	engine.release.early = release();
});

export const laterWriterCommitted = events.trait("history", "beta commits while alpha's earlier event is still uncommitted", (engine) =>
	engine.history.append({ events: [{ name: "Later" }], expectedVersion: 0, requestId: "later", stream: "beta" }).pipe(Effect.asVoid),
);

export const unprojectableHistory = events.trait("history", "alice has an event the current projection refuses", (engine) =>
	engine.history.append({ events: [{ name: "Rejected" }], expectedVersion: 1, requestId: "unprojectable", stream: "alice" }).pipe(Effect.asVoid),
);
