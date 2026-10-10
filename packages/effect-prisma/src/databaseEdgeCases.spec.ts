import { Cause, Effect, Exit, Redacted, Stream } from "effect";
import { expect } from "vitest";
import { makeDatabase } from "#database.ts";
import { type Contract, contractJson } from "#test/contract.ts";
import { environmentVariable } from "#test/environment.ts";
import { missingTableContract } from "#test/missingTableContract.ts";
import { multipleNamespaceContract } from "#test/multipleNamespaceContract.ts";
import { Database, integrationEffect, uniqueEmail, withDatabase } from "#test/postgres-database.ts";
import { unavailablePostgresUrl } from "#test/unavailablePostgresUrl.ts";
import { withTestTransaction } from "#testing/transaction.ts";

integrationEffect("refuses an empty dynamically assembled include query record", () =>
	withDatabase(
		Effect.gen(function* () {
			const db = yield* Database;
			const queries: Record<string, unknown> = {};
			const relation: Effect.Effect<unknown, unknown> = Reflect.apply(db.User.include, db.User, ["posts", queries]);
			const exit = yield* Effect.exit(relation);

			expect(Exit.isFailure(exit)).toBe(true);
			if (Exit.isFailure(exit)) {
				expect(Cause.pretty(exit.cause)).toContain("An included query record cannot be empty");
			}
		}),
	),
);

integrationEffect("preserves a lazy Relation through native Promise resolution", () =>
	withDatabase(
		Effect.gen(function* () {
			const db = yield* Database;
			const relation = db.User.where({ email: uniqueEmail("promise-resolution") });
			const resolved = yield* Effect.promise(() => Promise.resolve(relation));

			expect(resolved).toBe(relation);
			expect(yield* resolved.exists()).toBe(false);
		}),
	),
);

integrationEffect("rolls back writes through the curried test transaction helper", () =>
	withDatabase(
		Effect.gen(function* () {
			const db = yield* Database;
			const id = crypto.randomUUID();
			const value = yield* Effect.gen(function* () {
				const transactionDb = yield* Database;
				yield* transactionDb.User.create({ email: uniqueEmail("curried"), id, name: "Curried transaction" });
				return id;
			}).pipe(withTestTransaction(Database));

			expect(value).toBe(id);
			expect(yield* db.User.where({ id }).exists()).toBe(false);
		}),
	),
);

integrationEffect("reports a connection failure when PostgreSQL refuses its socket", () => {
	const UnavailableDatabase = makeDatabase<Contract>()("@test/UnavailableDatabase", { contractJson });
	return Effect.gen(function* () {
		const url = yield* Effect.promise(() =>
			unavailablePostgresUrl(environmentVariable("PLATFORM_EFFECT_PRISMA_TEST_DATABASE_URL") ?? "postgresql://integration-tests-disabled"),
		);
		const error = yield* Effect.flip(
			Effect.flatMap(UnavailableDatabase, (db) => db.User.count()).pipe(
				Effect.provide(UnavailableDatabase.layer({ url: Redacted.make(url), verifyMarker: false })),
			),
		);

		expect(error.reason).toMatchObject({ _tag: "PrismaConnectionFailure", transient: false });
		if (error.reason._tag === "PrismaConnectionFailure") {
			expect(Redacted.value(error.reason.original)).toMatchObject({ kind: "sql_connection", message: expect.stringContaining("ECONNREFUSED") });
		}
	});
});

integrationEffect("keeps PostgreSQL stream query errors in the typed failure channel", () => {
	const url = new URL(environmentVariable("PLATFORM_EFFECT_PRISMA_TEST_DATABASE_URL") ?? "postgresql://integration-tests-disabled");
	const tableName = `missing_user_${crypto.randomUUID().replaceAll("-", "")}`;
	const EmptyDatabase = makeDatabase<Contract>()("@test/MissingTableDatabase", { contractJson: missingTableContract(tableName) });
	return Effect.gen(function* () {
		const error = yield* Effect.flip(
			Effect.flatMap(EmptyDatabase, (db) => Stream.runCollect(db.User.stream)).pipe(
				Effect.provide(EmptyDatabase.layer({ url: url.toString(), verifyMarker: false })),
			),
		);

		expect(error.reason).toMatchObject({ _tag: "PrismaQueryFailure", sqlState: "42P01" });
		if (error.reason._tag === "PrismaQueryFailure") {
			expect(Redacted.value(error.reason.original)).toMatchObject({ kind: "sql_query", message: `relation "public.${tableName}" does not exist` });
		}
	});
});

integrationEffect("refuses a test transaction on a Database after its Layer closes", () =>
	Effect.gen(function* () {
		const escaped = yield* withDatabase(Database);
		const error = yield* Effect.flip(
			withTestTransaction(
				Database,
				Effect.gen(function* () {
					const db = yield* Database;
					return yield* db.User.count();
				}),
			).pipe(Effect.provideService(Database, escaped)),
		);

		expect(error.reason).toMatchObject({ _tag: "PrismaRuntimeFailure", code: "RUNTIME.DATABASE_CLOSED" });
	}),
);

integrationEffect("reports the supported namespace boundary for a multi-schema contract", () => {
	const MultiSchemaDatabase = makeDatabase<Contract>()("@test/MultiSchemaDatabase", { contractJson: multipleNamespaceContract });
	return Effect.gen(function* () {
		const exit = yield* Effect.exit(
			MultiSchemaDatabase.pipe(
				Effect.provide(
					MultiSchemaDatabase.layer({
						url: environmentVariable("PLATFORM_EFFECT_PRISMA_TEST_DATABASE_URL") ?? "postgresql://integration-tests-disabled",
					}),
				),
			),
		);

		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isFailure(exit)) {
			expect(Cause.pretty(exit.cause)).toContain("Effect Prisma currently requires exactly one domain namespace");
		}
	});
});
