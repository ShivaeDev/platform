import { withApprovedPrDaemon } from "#test/approvedPrDaemon.ts";
import { postgresTests } from "#test/postgres.ts";
import { watchReview } from "#test/watchReview.ts";

const test = postgresTests("live");

for (const initialReady of [true, false]) {
	for (const ids of [[], ["one"]]) {
		test(`watch --follow with ${ids.length === 0 ? "all" : "explicit"} IDs reports real review completion with initial readiness=${initialReady}`, () =>
			withApprovedPrDaemon((fixture) => fixture.serve((client, port) => watchReview(fixture, client, port, ids, initialReady))));
	}
}
