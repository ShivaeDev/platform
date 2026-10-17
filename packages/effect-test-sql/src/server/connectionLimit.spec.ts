import * as PgClient from "@effect/sql-pg/PgClient";
import { Effect, Layer } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { isSqlError } from "effect/sql/SqlError";
import { expect } from "vitest";
import { limitedRole } from "#test/limitedRole.ts";
import { integration, runAdmin, runDatabase, setup } from "#test/postgres.ts";
import { PostgresTestDatabase } from "./database.ts";
import { makePostgresTestLayer } from "./postgres.ts";
import { withIsolatedDatabase } from "./withIsolatedDatabase.ts";
import { withTestTransaction } from "./withTestTransaction.ts";

function expectConnectionLimit(error: unknown) {
	expect(isSqlError(error)).toBe(true);
	if (isSqlError(error)) {
		expect(error.message).toContain("max_connections");
		expect(error.message).toContain("vitest run --maxWorkers=4");
		expect(error.reason.cause).toMatchObject({ code: "53300" });
	}
}

integration("other PostgreSQL failures keep their original identity through both test wrappers", async () => {
	await runDatabase(
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const error = yield* sql`select 1 / 0`.pipe(Effect.flip);
			expect(yield* withTestTransaction(Effect.fail(error)).pipe(Effect.flip)).toBe(error);
			expect(yield* withIsolatedDatabase(Effect.fail(error)).pipe(Effect.flip)).toBe(error);
		}),
	);
});

integration("connection exhaustion during setup names the limit and a worker count to try", async () => {
	await runAdmin(
		Effect.gen(function* () {
			const url = yield* limitedRole();
			yield* Effect.scoped(
				Effect.gen(function* () {
					yield* PgClient.makeClient({ url });
					const error = yield* Effect.scoped(Layer.build(makePostgresTestLayer({ ...setup().options, url }))).pipe(Effect.flip);
					expectConnectionLimit(error);
				}),
			).pipe(Effect.provide(Reactivity.layer));
		}),
	);
});

integration("a worker releases its admin connection before migrations, tests and clone creation", async () => {
	await runAdmin(
		Effect.gen(function* () {
			const url = yield* limitedRole(2);
			yield* Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				expect(yield* sql`select value from items`).toEqual([{ value: "seed" }]);
				yield* withIsolatedDatabase(
					Effect.gen(function* () {
						const clone = yield* SqlClient.SqlClient;
						expect(yield* clone`select value from items`).toEqual([{ value: "seed" }]);
					}),
				);
			}).pipe(Effect.provide(makePostgresTestLayer({ ...setup().options, url })));
		}),
	);
});

integration("connection exhaustion during a rollback transaction retains SQLSTATE and adds worker guidance", async () => {
	await runAdmin(
		Effect.gen(function* () {
			const url = yield* limitedRole();
			yield* Effect.scoped(
				Effect.gen(function* () {
					const sql = yield* SqlClient.SqlClient;
					yield* sql.reserve;
					expectConnectionLimit(yield* withTestTransaction(Effect.void).pipe(Effect.flip));
				}),
			).pipe(Effect.provide(makePostgresTestLayer({ ...setup().options, url })));
		}),
	);
});

integration("connection exhaustion in an isolated body retains SQLSTATE and adds worker guidance", async () => {
	await runAdmin(
		Effect.gen(function* () {
			const url = yield* limitedRole();
			yield* Effect.gen(function* () {
				const error = yield* withIsolatedDatabase(
					Effect.gen(function* () {
						const sql = yield* SqlClient.SqlClient;
						yield* sql.reserve;
						const database = yield* PostgresTestDatabase;
						return yield* PgClient.makeClient({ url: database.url });
					}),
				).pipe(Effect.flip);
				expectConnectionLimit(error);
			}).pipe(Effect.provide(makePostgresTestLayer({ ...setup().options, url })));
		}),
	);
});
