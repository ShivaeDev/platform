import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { databaseHealth } from "#test/app-host/database.ts";
import { assets } from "#test/app-host/options.ts";
import { host } from "#test/app-host/story.ts";

for (const source of ["migrations", "services"] as const) {
	host.it(
		`health probes PostgreSQL from ${source} without authentication or database details`,
		[databaseHealth(source), assets],
		function* ({ health, reachable, responsive, lookups }) {
			for (const [available, status] of [
				[true, HttpStatus.fromLiteral("OK")],
				[false, HttpStatus.fromLiteral("ServiceUnavailable")],
				[true, HttpStatus.fromLiteral("OK")],
			] as const) {
				yield* reachable(available);
				expect(yield* health()).toEqual({ body: "", cacheControl: "no-store", status });
			}
			yield* responsive(false);
			expect(yield* health()).toMatchObject({ body: "", status: HttpStatus.fromLiteral("ServiceUnavailable") });
			expect(lookups()).toEqual([]);
		},
	);
}
