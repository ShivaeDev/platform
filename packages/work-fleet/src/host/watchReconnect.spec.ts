import { withHost } from "#test/fleetHost.ts";
import { postgresTests } from "#test/postgres.ts";
import { watchReconnect } from "#test/watchReconnect.ts";

const test = postgresTests("live");

for (const ids of [[], ["done", "gone", "active"]]) {
	test(`watch --follow with ${ids.length === 0 ? "all" : "explicit"} IDs stays quiet across unchanged HTTP restarts and reports a gap transition once`, () =>
		withHost({}, {}, (fixture) => watchReconnect(fixture, ids)));
}
