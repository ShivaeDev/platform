import { Effect, Fiber, Redacted } from "effect";
import { SqlClient } from "effect/sql";
import { expect } from "vitest";
import { databasePressure } from "#test/databasePressure.ts";
import { integration, runAdmin, setup } from "#test/postgres.ts";
import { makePostgresTestLayer } from "./postgres.ts";

for (const maxConnections of [undefined, 3]) {
	integration(`12 concurrent databases use at most ${maxConnections ?? 2} connections each, with no idle administration sessions`, async () => {
		await runAdmin(
			Effect.gen(function* () {
				const admin = yield* SqlClient.SqlClient;
				const marker = `budget_${crypto.randomUUID()}`;
				const kit = setup();
				const url = new URL(Redacted.value(kit.options.url));
				url.searchParams.set("application_name", marker);
				const poolSize = maxConnections ?? 2;
				const options = {
					...kit.options,
					...(maxConnections === undefined ? {} : { maxConnections }),
					url: Redacted.make(url.toString()),
				};
				const sessions = admin<{ count: number }>`select count(*)::int as count from pg_stat_activity where application_name = ${marker}`;
				yield* Effect.scoped(
					Effect.gen(function* () {
						expect(yield* sessions).toEqual([{ count: 0 }]);
						const pressure = yield* databasePressure(12, poolSize);
						yield* pressure.ready;
						yield* Effect.sleep("100 millis");
						expect(yield* sessions).toEqual([{ count: 12 * poolSize }]);
						yield* pressure.release;
						expect((yield* Fiber.join(pressure.clones)).flat()).toHaveLength(72);
					}).pipe(Effect.provide(makePostgresTestLayer(options))),
				);
				expect(yield* sessions).toEqual([{ count: 0 }]);
			}).pipe(Effect.timeout("20 seconds")),
		);
	});
}
