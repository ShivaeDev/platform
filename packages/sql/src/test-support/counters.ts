import { Effect, Order, Result, type Schema } from "effect";
import type { SqlError } from "effect/sql/SqlError";
import { raceWithLock } from "@shivaedev/test-sql/server/raceWithLock.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { UpsertResult } from "#conditionalUpsert.ts";
import type { UpsertRow } from "#upsertResult.ts";
import { type Counter, counterEngine, counterSettings, observed } from "./counterEngine.ts";
import { onPostgres } from "./engines.ts";

export const counterWrites = ["upsert", "upsertMany", "conditionalUpsert", "conditionalUpsertMany"] as const;
export type CounterWrite = (typeof counterWrites)[number];

type WriteResult = UpsertRow<Counter> | UpsertResult<Counter>;

export const counters = storyKit({
	...onPostgres,
	create: counterEngine,
	name: "PostgreSQL counter upserts",
	stages: ["rows"],
	verbs: (engine, story) => {
		const { rows } = engine;
		function write(input: Counter, operation: CounterWrite, allowed = true): Effect.Effect<readonly WriteResult[], SqlError | Schema.SchemaError> {
			const conditional = { ...counterSettings, updateWhere: { note: allowed ? "original" : "not stored" } };
			switch (operation) {
				case "upsert":
					return Effect.map(rows.upsert(input, counterSettings), (value) => [value]);
				case "upsertMany":
					return rows.upsertMany([input], counterSettings);
				case "conditionalUpsert":
					return Effect.map(rows.upsert(input, conditional), (value) => [value]);
				case "conditionalUpsertMany":
					return rows.upsertMany([input], conditional);
			}
		}
		function remember(values: readonly WriteResult[]) {
			return Effect.sync(() =>
				engine.returned.push(...values.map((value) => ("row" in value ? { inserted: value.inserted, row: value.row } : "unchanged"))),
			);
		}
		return {
			counter: () => Effect.map(rows.findById(1), ({ count, label, note }) => ({ count, label, note })),
			incrementConcurrently: (increments: readonly number[], lockedIncrement: number) =>
				Effect.gen(function* () {
					story.tell(`separate connections add ${increments.join(", ")} while another adds ${lockedIncrement} and holds the row lock until commit`);
					const input = { id: 1, label: null, note: "concurrent" };
					const results = yield* raceWithLock({
						effects: increments.map((count) => rows.upsert({ ...input, count }, counterSettings)),
						lock: rows.upsert({ ...input, count: lockedIncrement }, counterSettings),
						release: "commit",
					});
					return yield* Effect.forEach(results, (result) => Result.match(result, { onFailure: Effect.fail, onSuccess: Effect.succeed }));
				}),
			publishedKeys: () =>
				Effect.map(engine.capture.attempted, (batches) =>
					[...new Set(batches.flat().map((key) => String(key).replaceAll(engine.tableName, "counters")))].toSorted(Order.String),
				),
			returned: () => Effect.sync(() => [...engine.returned]),
			upsertCounter: (operation: CounterWrite, count: number, label: string | null, allowed = true) =>
				Effect.suspend(() => {
					story.tell(`${operation} offers counter 1 an increment of ${count}, label ${JSON.stringify(label)} and note incoming`);
					return observed(engine, write({ count, id: 1, label, note: "incoming" }, operation, allowed)).pipe(Effect.tap(remember));
				}),
		};
	},
});

export function counterStored(count: number, label: string | null = "saved") {
	return counters.trait("rows", `counter 1 holds ${count}, label ${JSON.stringify(label)} and note original`, ({ rows }) =>
		rows.insert({ count, id: 1, label, note: "original" }),
	);
}
