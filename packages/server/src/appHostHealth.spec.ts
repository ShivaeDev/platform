import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { databaseHealth } from "#test/app-host/database.ts";
import { assets } from "#test/app-host/options.ts";
import { host } from "#test/app-host/story.ts";

const healthy = { body: "", cacheControl: "no-store", status: HttpStatus.fromLiteral("OK") };
const unavailable = { body: "", cacheControl: "no-store", status: HttpStatus.fromLiteral("ServiceUnavailable") };

for (const source of ["migrations", "services"] as const) {
	host.it(
		`health answers an empty uncacheable 200 beside the SPA without a session lookup while PostgreSQL from ${source} is reachable`,
		[databaseHealth(source), assets],
		function* ({ health, sessionLookups }) {
			yield* outcomes({
				"health": [health(), healthy],
				"session lookups": [sessionLookups(), []],
			});
		},
	);

	host.it(
		`health answers an empty uncacheable 503 once PostgreSQL from ${source} goes down`,
		[databaseHealth(source)],
		function* ({ databaseGoesDown, health }) {
			expect(yield* health()).toEqual(healthy);

			yield* databaseGoesDown();

			expect(yield* health()).toEqual(unavailable);
		},
	);

	host.it(
		`health answers 200 again once PostgreSQL from ${source} recovers`,
		[databaseHealth(source)],
		function* ({ databaseGoesDown, databaseRecovers, health }) {
			yield* databaseGoesDown();
			expect(yield* health()).toEqual(unavailable);

			yield* databaseRecovers();

			expect(yield* health()).toEqual(healthy);
		},
	);

	host.it(
		`health answers 503 when PostgreSQL from ${source} stops answering`,
		[databaseHealth(source)],
		function* ({ databaseStopsAnswering, health }) {
			expect(yield* health()).toEqual(healthy);

			yield* databaseStopsAnswering();

			expect(yield* health()).toMatchObject({ body: "", status: HttpStatus.fromLiteral("ServiceUnavailable") });
		},
	);
}
