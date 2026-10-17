import { expect } from "vitest";
import { postgres } from "#test/postgres.ts";
import { discoveryFails, readyAfter } from "#test/postgresTraits.ts";

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
