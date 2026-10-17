import { Clock } from "effect";
import { expect } from "vitest";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { createApplication } from "./applicationEngine.ts";
import { isolate, wholeStack } from "./isolation.ts";
import { hasPostgres, kitDatabases, workerDatabase } from "./postgres.ts";
import { activeScreens } from "./screens.ts";
import { orderVerbs } from "./verbs.ts";

export const app = storyKit({
	around: isolate(wholeStack),
	clock: "live",
	*create() {
		const engine = yield* createApplication;
		window.location.href = engine.url;
		return engine;
	},
	inspect: (engine) => ({ changes: engine.changes, observations: engine.observations, orders: [...engine.orders] }),
	layer: workerDatabase,
	name: "orders",
	runIf: hasPostgres,
	stages: ["database", "orders", "screen"],
	verbs: (engine, story) => orderVerbs(engine, story.tell),
});

export function realPostgres() {
	return app.trait("database", "real PostgreSQL uses HTTP, truncation and real commits", function* (engine) {
		kitDatabases.add(engine.database.name);
		expect(activeScreens.size).toBe(0);
		expect(yield* Clock.currentTimeMillis).toBeGreaterThan(1_000_000);
		expect(engine.database.sql).not.toBe(engine.database.observer);
		expect(yield* engine.database.observer`select migration_id from effect_sql_migrations`).toEqual([{ "migration_id": 1 }]);
		expect(yield* engine.database.observer`select id from orders`).toEqual([]);
	});
}
