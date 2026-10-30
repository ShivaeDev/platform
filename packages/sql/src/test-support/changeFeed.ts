import { Effect, Queue } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { type ChangeFeedEngine, changeFeedEngine, type FeedTiming } from "./changeFeedEngine.ts";
import { instrumentedClient } from "./changeFeedListener.ts";
import { copiesTables, documentsTable, generatedTable, readingsTable, rowsTable } from "./changeFeedTables.ts";
import { changeFeedVerbs, keyOf } from "./changeFeedVerbs.ts";
import { onPostgres } from "./engines.ts";
import { listenerVerbs, startFeed } from "./listenerVerbs.ts";

export const changeFeed = storyKit({
	...onPostgres,
	clock: "test",
	create: changeFeedEngine,
	inspect: (engine: ChangeFeedEngine) => ({ history: engine.controls.history, logs: engine.logs, payloads: engine.controls.payloads }),
	name: "PostgreSQL change feed",
	stages: ["listener", "feed", "tables", "subscribers"],
	verbs: (engine: ChangeFeedEngine, story: { readonly tell: (line: string) => void }) => ({
		...changeFeedVerbs(engine, story.tell),
		...listenerVerbs(engine, story.tell),
	}),
});

export function listenerCleanupStalls() {
	return changeFeed.trait("listener", "closing a lost listener runs a cleanup that never finishes", (engine) =>
		Effect.sync(() => {
			engine.controls.cleanupStalls = true;
		}),
	);
}

function timingLine(timing: Partial<FeedTiming>) {
	const parts = Object.entries(timing).map(([name, value]) => `${name} ${String(value)}`);
	return parts.length === 0 ? "" : `, with ${parts.join(", ")}`;
}

export function feedListens(timing: Partial<FeedTiming> = {}) {
	return changeFeed.trait("feed", `the change feed listens for NOTIFY on its own channel${timingLine(timing)}`, function* (engine) {
		engine.timing = { ...engine.timing, ...timing };
		yield* startFeed(
			engine,
			engine.channel,
			instrumentedClient(engine.client, engine.unreachable, engine.controls, engine.events, engine.stalledCleanup),
		);
		yield* Queue.take(engine.events.listeners);
		yield* Queue.take(engine.events.resyncs);
	});
}

const TABLES = {
	copies: copiesTables,
	documents: Effect.map(documentsTable, (documents) => ({ documents })),
	generated: Effect.map(generatedTable, (generated) => ({ generated })),
	readings: Effect.map(readingsTable, (readings) => ({ readings })),
	rows: Effect.map(rowsTable, (rows) => ({ rows })),
} as const;

const TABLE_LINES: Readonly<Record<keyof typeof TABLES, string>> = {
	copies: "sources and their copies with generated ids exist",
	documents: "documents with generated ids and lock versions exist",
	generated: "rows with generated ids exist",
	readings: "readings keyed by source and sequence exist",
	rows: "rows with a parent checked at COMMIT exist",
};

export function hasTable(name: keyof typeof TABLES) {
	return changeFeed.trait("tables", TABLE_LINES[name], function* (engine) {
		Object.assign(engine.tables, yield* TABLES[name]);
	});
}

export function watching(...keys: readonly string[]) {
	return changeFeed.trait("subscribers", `a subscriber watches ${keys.map((key) => key.slice(0, 20)).join(", ")}`, function* (engine) {
		for (const key of keys) {
			const stop = engine.reactivity.registerUnsafe([keyOf(engine, key)], () => engine.announced.push(keyOf(engine, key)));
			yield* Effect.addFinalizer(() => Effect.sync(stop));
		}
	});
}

export function idsFrom(first: number, count: number) {
	return Array.from({ length: count }, (_, index) => first + index);
}

export function keysOf(table: string, ids: readonly number[]) {
	return [table, ...ids.map((id) => `${table}:${id}`)];
}
