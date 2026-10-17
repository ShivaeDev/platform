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
				[true, 200],
				[false, 503],
				[true, 200],
			] as const) {
				yield* reachable(available);
				expect(yield* health()).toEqual({ body: "", cacheControl: "no-store", status });
			}
			yield* responsive(false);
			expect(yield* health()).toMatchObject({ body: "", status: 503 });
			expect(lookups()).toEqual([]);
		},
	);
}
