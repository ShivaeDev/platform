import { withHost } from "#test/fleetHost.ts";
import { postgresTests } from "#test/postgres.ts";
import { watchReconnect } from "#test/watchReconnect.ts";

const test = postgresTests("live");

for (const ids of [[], ["done", "gone", "active", "waiting"]]) {
	test(`watch --follow with ${ids.length === 0 ? "all" : "explicit"} IDs keeps unchanged restarts quiet and reports gap and live transitions after reconnect`, () =>
		withHost({}, {}, (fixture) => watchReconnect(fixture, ids)));
}
