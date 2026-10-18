import { expect } from "vitest";
import { postgres } from "#test/postgres.ts";
import { discoveryFails, readyAfter, startupAttempts } from "#test/postgresTraits.ts";

postgres.it(
	"steps readiness probes until PostgreSQL reports the pinned version",
	[readyAfter(2)],
	function* ({ checkReadiness, readinessAttempts, stop }) {
		yield* checkReadiness();
		expect(readinessAttempts()).toBe(3);
		yield* stop();
	},
);

postgres.it(
	"retries Docker discovery while a started container becomes ready, then checks real PostgreSQL",
	[discoveryFails(2)],
	function* ({ start, checkReadiness, stop }) {
		expect(start).not.toThrow();
		yield* checkReadiness();
		yield* stop(4);
	},
);

postgres.it(
	"stops after the configured readiness attempts when Docker never reports a PostgreSQL container",
	[discoveryFails(4), startupAttempts(3)],
	function* ({ start, stop }) {
		expect(start).toThrow("Expected local PostgreSQL 18.6. Check the existing service; setup never removes containers or data.");
		yield* stop(4);
	},
);

postgres.it("makes thirty readiness attempts by default", [discoveryFails(31)], function* ({ start, stop }) {
	expect(start).toThrow("Expected local PostgreSQL 18.6.");
	yield* stop(31);
});
