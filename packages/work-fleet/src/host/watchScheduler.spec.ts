import { withHost } from "#test/fleetHost.ts";
import { postgresTests } from "#test/postgres.ts";
import { watchScheduler } from "#test/watchScheduler.ts";

const test = postgresTests("live");

for (const ids of [[], ["connected", "one"]]) {
	for (const paused of [false, true]) {
		test(`an already connected ${ids.length === 0 ? "all-item" : "explicit-item"} follow watch sees an independent scheduler's review completion with approval wait=${paused}`, () =>
			withHost({}, { intervalSeconds: 0.05 }, (fixture) => watchScheduler(fixture, ids, paused)));
	}
}
