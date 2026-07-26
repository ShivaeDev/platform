import { it } from "@effect/vitest";
import { Deferred, Effect, Exit, Fiber } from "effect";
import { expect } from "vitest";
import { makeDatabase } from "../src/index.js";
import { type Contract, contractJson } from "./contract.js";

const databaseUrl = process.env.PLATFORM_EFFECT_PRISMA_TEST_DATABASE_URL;
const integrationEffect =
	databaseUrl === undefined ? it.effect.skip : it.effect;

const Database = makeDatabase<Contract>("@test/IntegrationDatabase", {
	contractJson,
});
const DatabaseLive = Database.layer({
	url: databaseUrl ?? "postgresql://integration-tests-disabled",
});
const withDatabase = Effect.provide(DatabaseLive);

const uniqueEmail = (scenario: string): string =>
	`${scenario}-${crypto.randomUUID()}@example.test`;

integrationEffect("owns the client and commits successful transactions", () =>
	withDatabase(
		Effect.gen(function* () {
			const db = yield* Database;
			const email = uniqueEmail("commit");
			const relation = db.User.where({ email });

			const exists = yield* relation.exists();
			expect(exists).toBe(false);

			yield* db.transaction(
				db.User.create({
					id: crypto.randomUUID(),
					email,
					name: "Committed",
				}),
			);

			expect(yield* relation.exists()).toBe(true);
		}),
	),
);

integrationEffect("returns structured query failures", () =>
	withDatabase(
		Effect.gen(function* () {
			const db = yield* Database;
			const email = uniqueEmail("unique");

			yield* db.User.create({
				id: crypto.randomUUID(),
				email,
				name: "Original",
			});

			const error = yield* Effect.flip(
				db.User.create({
					id: crypto.randomUUID(),
					email,
					name: "Duplicate",
				}),
			);

			expect(error._tag).toBe("PrismaError");
			expect(error.reason._tag).toBe("PrismaQueryFailure");
			if (error.reason._tag === "PrismaQueryFailure") {
				expect(error.reason.sqlState).toBe("23505");
				expect(error.reason.constraint).toBe("User_email_key");
			}
		}),
	),
);

integrationEffect("reuses the active transaction for nested boundaries", () =>
	withDatabase(
		Effect.gen(function* () {
			const db = yield* Database;
			const email = uniqueEmail("nested");
			const relation = db.User.where({ email });

			yield* db.transaction(
				db.transaction(
					db.User.create({
						id: crypto.randomUUID(),
						email,
						name: "Nested",
					}),
				),
			);

			expect(yield* relation.exists()).toBe(true);
		}),
	),
);

integrationEffect(
	"replays an existing Relation in the transaction and rolls back failures",
	() =>
		withDatabase(
			Effect.gen(function* () {
				const db = yield* Database;
				const email = uniqueEmail("failure");
				const relation = db.User.where({ email });

				const exit = yield* Effect.exit(
					db.transaction(
						Effect.gen(function* () {
							yield* db.User.create({
								id: crypto.randomUUID(),
								email,
								name: "Rolled back",
							});
							expect(yield* relation.exists()).toBe(true);
							return yield* Effect.fail("expected failure");
						}),
					),
				);

				expect(Exit.isFailure(exit)).toBe(true);
				expect(yield* relation.exists()).toBe(false);
			}),
		),
);

integrationEffect("rolls back interrupted transactions before returning", () =>
	withDatabase(
		Effect.gen(function* () {
			const db = yield* Database;
			const email = uniqueEmail("interruption");
			const created = yield* Deferred.make<void>();
			const relation = db.User.where({ email });

			const fiber = yield* Effect.forkDetach(
				db.transaction(
					Effect.gen(function* () {
						yield* db.User.create({
							id: crypto.randomUUID(),
							email,
							name: "Interrupted",
						});
						yield* Deferred.succeed(created, undefined);
						return yield* Effect.never;
					}),
				),
				{ startImmediately: true },
			);

			yield* Deferred.await(created);
			yield* Fiber.interrupt(fiber);

			const exists = yield* relation.exists();
			expect(exists).toBe(false);
		}),
	),
);
