import { Effect, Layer } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { TooManyRequests } from "@shivaedev/errors/taxonomy.ts";
import { advisoryXactLock } from "@shivaedev/sql/advisoryXactLock.ts";
import { transact } from "@shivaedev/sql/transact.ts";
import { Store, StoreError, type WindowRequest } from "#Store.ts";

export const postgresStore = Layer.effect(Store)(
	Effect.gen(function* () {
		const sql = (yield* SqlClient.SqlClient).withoutTransforms();
		const reactivity = yield* Reactivity.Reactivity;
		return {
			consume: ({ key, per, windowMillis }: WindowRequest) =>
				Effect.gen(function* () {
					yield* advisoryXactLock(`@shivaedev/rate-limit:${key}`).pipe(Effect.catchTag("AdvisoryLockOutsideTransaction", Effect.die));
					const [clock] = yield* sql<{ now: number }>`select extract(epoch from clock_timestamp())::double precision * 1000 as now`;
					if (clock === undefined) {
						return yield* Effect.die(new Error("PostgreSQL returned no clock"));
					}
					const now = clock.now;
					const rows = yield* sql<{ expiresAt: number }>`insert into rate_limit_windows (key, count, expires_at)
				values (${key}, 1, ${now + windowMillis})
				on conflict (key) do update set
					count = case when rate_limit_windows.expires_at <= ${now} then 1 else rate_limit_windows.count + 1 end,
					expires_at = case when rate_limit_windows.expires_at <= ${now} then ${now + windowMillis} else rate_limit_windows.expires_at end
				where rate_limit_windows.expires_at <= ${now} or rate_limit_windows.count < ${per}
				returning expires_at as "expiresAt"`;
					if (rows.length > 0) {
						return;
					}
					const [entry] = yield* sql<{ expiresAt: number }>`select expires_at as "expiresAt" from rate_limit_windows where key = ${key}`;
					if (entry === undefined) {
						return yield* Effect.die(new Error("Rate limit window disappeared while locked"));
					}
					return yield* new TooManyRequests({ key, message: "Rate limit exceeded", retryAt: entry.expiresAt });
				}).pipe(
					transact({ onSqlError: (cause) => new StoreError({ cause }) }),
					Effect.provideService(SqlClient.SqlClient, sql),
					Effect.provideService(Reactivity.Reactivity, reactivity),
				),
		};
	}),
);
