import { withHost } from "#test/fleetHost.ts";
import { postgresTests } from "#test/postgres.ts";
import { watchScheduler } from "#test/watchScheduler.ts";

const test = postgresTests("live");

for (const paused of [false, true]) {
	test(`already connected all-item and explicit-item follow watches see an independent scheduler's review completion with approval wait=${paused}`, () =>
		withHost({}, { intervalSeconds: 0.05 }, (fixture) => watchScheduler(fixture, paused)));
}
