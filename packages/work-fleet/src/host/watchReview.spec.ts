import { withApprovedPrDaemon } from "#test/approvedPrDaemon.ts";
import { postgresTests } from "#test/postgres.ts";
import { watchReview } from "#test/watchReview.ts";

const test = postgresTests("live");

for (const initialReady of [true, false]) {
	test(`watch --follow with all and explicit IDs reports real review completion with initial readiness=${initialReady}`, () =>
		withApprovedPrDaemon((fixture) => fixture.serve((client, port) => watchReview(fixture, client, port, initialReady))));
}
