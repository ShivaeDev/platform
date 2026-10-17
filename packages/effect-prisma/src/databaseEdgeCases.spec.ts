import { Cause, Effect, Exit, Redacted } from "effect";
import { expect } from "vitest";
import { Database, uniqueEmail } from "#test/postgres-database.ts";
import { postgresStory } from "#test/postgresStory.ts";
import { withTestTransaction } from "#testing/transaction.ts";

postgresStory.it("refuses an empty dynamically assembled include query record", [], function* ({ db }) {
	const queries: Record<string, unknown> = {};
	const relation: Effect.Effect<unknown, unknown> = Reflect.apply(db.User.include, db.User, ["posts", queries]);
	const exit = yield* Effect.exit(relation);

	expect(Exit.isFailure(exit)).toBe(true);
	if (Exit.isFailure(exit)) {
		expect(Cause.pretty(exit.cause)).toContain("An included query record cannot be empty");
	}
});

postgresStory.it("preserves a lazy Relation through native Promise resolution", [], function* ({ db }) {
	const relation = db.User.where({ email: uniqueEmail("promise-resolution") });
	const resolved = yield* Effect.promise(() => Promise.resolve(relation));

	expect(resolved).toBe(relation);
	expect(yield* resolved.exists()).toBe(false);
});

postgresStory.it("rolls back writes through the curried test transaction helper", [], function* ({ db }) {
	const id = crypto.randomUUID();
	const value = yield* Effect.gen(function* () {
		const transactionDb = yield* Database;
		yield* transactionDb.User.create({ email: uniqueEmail("curried"), id, name: "Curried transaction" });
		return id;
	}).pipe(withTestTransaction(Database));

	expect(value).toBe(id);
	expect(yield* db.User.where({ id }).exists()).toBe(false);
});

postgresStory.it("reports a connection failure when PostgreSQL refuses its socket", [], function* ({ failures }) {
	const error = yield* failures.refusedSocket();
	expect(error.reason).toMatchObject({ _tag: "PrismaConnectionFailure", transient: false });
	if (error.reason._tag === "PrismaConnectionFailure") {
		expect(Redacted.value(error.reason.original)).toMatchObject({ kind: "sql_connection", message: expect.stringContaining("ECONNREFUSED") });
	}
});

postgresStory.it("keeps PostgreSQL stream query errors in the typed failure channel", [], function* ({ failures }) {
	const { error, tableName } = yield* failures.missingTable();
	expect(error.reason).toMatchObject({ _tag: "PrismaQueryFailure", sqlState: "42P01" });
	if (error.reason._tag === "PrismaQueryFailure") {
		expect(Redacted.value(error.reason.original)).toMatchObject({ kind: "sql_query", message: `relation "public.${tableName}" does not exist` });
	}
});

postgresStory.it("refuses a test transaction on a Database after its Layer closes", [], function* ({ rollback, escapedDatabase }) {
	const escaped = yield* escapedDatabase();
	const error = yield* Effect.flip(
		rollback(
			Effect.gen(function* () {
				const db = yield* Database;
				return yield* db.User.count();
			}),
		).pipe(Effect.provideService(Database, escaped)),
	);

	expect(error.reason).toMatchObject({ _tag: "PrismaRuntimeFailure", code: "RUNTIME.DATABASE_CLOSED" });
});

postgresStory.it("reports the supported namespace boundary for a multi-schema contract", [], function* ({ failures }) {
	const exit = yield* failures.multipleNamespaces();
	expect(Exit.isFailure(exit)).toBe(true);
	if (Exit.isFailure(exit)) {
		expect(Cause.pretty(exit.cause)).toContain("Effect Prisma currently requires exactly one domain namespace");
	}
});
