import { Clock } from "effect";
import { expect } from "vitest";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { isolate, wholeStack } from "#test/order-example/isolation.ts";
import { hasPostgres, workerDatabase } from "#test/order-example/postgres.ts";
import { createLiveEngine } from "./liveEngine.ts";
import { liveVerbs } from "./liveVerbs.ts";

const kit = storyKit({
	around: isolate(wholeStack),
	clock: "live",
	create: () => createLiveEngine,
	inspect: (engine) => ({
		database: engine.database.name,
		delivered: engine.server.delivered,
		publications: engine.server.publications,
		reads: engine.server.reads,
	}),
	layer: workerDatabase,
	name: "composed orders",
	stages: ["database", "commit", "editors"],
	verbs: (engine, story) => liveVerbs(engine, story.tell),
});
export const app = { ...kit, fails: hasPostgres ? kit.it.fails : kit.it.skip, it: kit.it.runIf(hasPostgres) };
export function realPostgres() {
	return app.trait("database", "the reference feature uses a leased disposable PostgreSQL database", function* ({ database }) {
		expect(yield* Clock.currentTimeMillis).toBeGreaterThan(1_000_000);
		expect(database.sql).not.toBe(database.observer);
	});
}
