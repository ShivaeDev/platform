import { it } from "@effect/vitest";
import { Cause, Deferred, Effect, Exit, Fiber, Option } from "effect";
import { expect } from "vitest";
import { makeDatabase } from "../src/index.js";
import { withTestTransaction } from "../src/testing.js";
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

integrationEffect(
	"forces rollback after a successful test transaction and returns its value",
	() =>
		withDatabase(
			Effect.gen(function* () {
				const db = yield* Database;
				const id = crypto.randomUUID();

				const value = yield* withTestTransaction(
					Database,
					db.User.create({
						id,
						email: `${id}@example.test`,
						name: "Test transaction",
					}).pipe(Effect.as(42)),
				);

				expect(value).toBe(42);
				expect(yield* db.User.where({ id }).exists()).toBe(false);
			}),
		),
);

integrationEffect(
	"preserves a test transaction failure while rolling back its writes",
	() =>
		withDatabase(
			Effect.gen(function* () {
				const db = yield* Database;
				const id = crypto.randomUUID();
				const failure = { _tag: "ExpectedFailure" as const };

				const exit = yield* Effect.exit(
					withTestTransaction(
						Database,
						Effect.gen(function* () {
							yield* db.User.create({
								id,
								email: `${id}@example.test`,
								name: "Failed test transaction",
							});
							return yield* Effect.fail(failure);
						}),
					),
				);

				expect(Exit.isFailure(exit)).toBe(true);
				if (Exit.isFailure(exit)) {
					expect(Option.getOrThrow(Cause.findErrorOption(exit.cause))).toBe(
						failure,
					);
				}
				expect(yield* db.User.where({ id }).exists()).toBe(false);
			}),
		),
);

integrationEffect(
	"runs aggregate, grouping, bulk create, update, and delete terminals",
	() =>
		withDatabase(
			withTestTransaction(
				Database,
				Effect.gen(function* () {
					const db = yield* Database;
					const marker = crypto.randomUUID();
					const created = yield* db.User.createAll([
						{
							id: crypto.randomUUID(),
							email: `${marker}-one@example.test`,
							name: marker,
						},
						{
							id: crypto.randomUUID(),
							email: `${marker}-two@example.test`,
							name: marker,
						},
					]);
					expect(created).toHaveLength(2);

					const aggregate = yield* db.User.where({ name: marker }).aggregate(
						(summary) => ({
							total: summary.count(),
						}),
					);
					expect(aggregate).toEqual({ total: 2 });

					const grouped = yield* db.User.where({ name: marker })
						.groupBy("name")
						.aggregate((summary) => ({
							total: summary.count(),
						}));
					expect(grouped).toEqual([{ name: marker, total: 2 }]);

					const updated = yield* db.User.where({ name: marker }).updateAll({
						name: `${marker}-updated`,
					});
					expect(updated).toHaveLength(2);

					const deleted = yield* db.User.where({
						name: `${marker}-updated`,
					}).deleteAll();
					expect(deleted).toHaveLength(2);
				}),
			),
		),
);
