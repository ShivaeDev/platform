import { DatabaseSync } from "node:sqlite";
import { it } from "@effect/vitest";
import { Cause, Deferred, Effect, Exit, Fiber, Option, Stream } from "effect";
import { afterAll, expect } from "vitest";
import { makeSqliteDatabase } from "../src/sqlite.js";
import { withTestTransaction } from "../src/testing.js";
import { type Contract, contractJson } from "./sqlite/contract.js";
import { makeTemporaryDatabase } from "./sqlite/support.js";

const temporary = makeTemporaryDatabase();
afterAll(temporary.remove);

const Database = makeSqliteDatabase<Contract>("@test/SqliteDatabase", {
	contractJson,
});
const DatabaseLive = Database.layer({ path: temporary.path });
const withDatabase = Effect.provide(DatabaseLive);

const uniqueEmail = (scenario: string): string =>
	`${scenario}-${crypto.randomUUID()}@example.test`;

const journalMode = (path: string): unknown => {
	const database = new DatabaseSync(path);
	try {
		return database.prepare("PRAGMA journal_mode").get()?.journal_mode;
	} finally {
		database.close();
	}
};

it.effect("applies connect-time pragmas to the database file", () =>
	withDatabase(
		Effect.gen(function* () {
			const db = yield* Database;
			yield* db.User.count();

			expect(journalMode(temporary.path)).toBe("wal");
		}),
	),
);

it.effect("owns the client and commits successful transactions", () =>
	withDatabase(
		Effect.gen(function* () {
			const db = yield* Database;
			const email = uniqueEmail("commit");
			const relation = db.User.where({ email });

			expect(yield* relation.exists()).toBe(false);

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

it.effect("returns structured query failures", () =>
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
				expect(error.reason.constraint).toBe("user.email");
			}
		}),
	),
);

it.effect("uses Date values for SQLite datetime columns", () =>
	withDatabase(
		withTestTransaction(
			Database,
			Effect.gen(function* () {
				const db = yield* Database;
				const createdAt = new Date("2026-08-03T12:34:56.789Z");
				const verifiedAt = new Date("2026-08-03T14:00:00.123Z");
				const user = yield* db.User.create({
					createdAt,
					email: uniqueEmail("timestamp"),
					id: crypto.randomUUID(),
					name: "Timestamp",
					verifiedAt,
				});

				expect(user.createdAt).toBeInstanceOf(Date);
				expect(user.createdAt.getTime()).toBe(createdAt.getTime());
				expect(user.verifiedAt).toBeInstanceOf(Date);
				expect(user.verifiedAt?.getTime()).toBe(verifiedAt.getTime());
				expect(
					yield* db.User.where((row) => row.createdAt.eq(createdAt)).exists(),
				).toBe(true);
			}),
		),
	),
);

it.effect("generates a UTC timestamp when the column default applies", () =>
	withDatabase(
		withTestTransaction(
			Database,
			Effect.gen(function* () {
				const db = yield* Database;
				const before = Date.now();
				const user = yield* db.User.create({
					email: uniqueEmail("default-timestamp"),
					id: crypto.randomUUID(),
					name: "Default timestamp",
				});

				expect(user.createdAt).toBeInstanceOf(Date);
				expect(user.createdAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
				expect(user.createdAt.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
			}),
		),
	),
);

it.effect("reuses the active transaction for nested boundaries", () =>
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

it.effect("serializes concurrent queries inside a transaction", () =>
	withDatabase(
		withTestTransaction(
			Database,
			Effect.gen(function* () {
				const db = yield* Database;
				const marker = crypto.randomUUID();
				const users = ["one", "two", "three"].map((suffix) => ({
					id: crypto.randomUUID(),
					email: `${marker}-${suffix}@example.test`,
					name: marker,
				}));

				yield* Effect.all(
					users.map((user) => db.User.create(user)),
					{ concurrency: "unbounded" },
				);

				expect(yield* db.User.where({ name: marker }).count()).toBe(3);
			}),
		),
	),
);

it.effect(
	"buffers transaction streams before downstream database effects",
	() =>
		withDatabase(
			withTestTransaction(
				Database,
				Effect.gen(function* () {
					const db = yield* Database;
					const marker = crypto.randomUUID();
					yield* db.User.createAll(
						["one", "two", "three"].map((suffix) => ({
							id: crypto.randomUUID(),
							email: `${marker}-${suffix}@example.test`,
							name: marker,
						})),
					);

					const exists = yield* Stream.runCollect(
						db.User.where({ name: marker }).stream.pipe(
							Stream.mapEffect((user) =>
								db.User.where({ id: user.id }).exists(),
							),
						),
					);

					expect(exists).toEqual([true, true, true]);
				}),
			),
		),
);

it.effect(
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

it.effect("rolls back interrupted transactions before returning", () =>
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

			expect(yield* relation.exists()).toBe(false);
		}),
	),
);

it.effect(
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

it.effect(
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

it.effect(
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

it.effect("loads related rows without changing the base relation", () =>
	withDatabase(
		withTestTransaction(
			Database,
			Effect.gen(function* () {
				const db = yield* Database;
				const userId = crypto.randomUUID();
				const firstPostId = crypto.randomUUID();
				yield* db.User.create({
					id: userId,
					email: uniqueEmail("include"),
					name: "Relation owner",
				});
				yield* db.Post.createAll([
					{
						id: firstPostId,
						title: "First post",
						userId,
					},
					{
						id: crypto.randomUUID(),
						title: "Second post",
						userId,
					},
				]);

				const base = db.User.where({ id: userId });
				const postTitles = db.Post.orderBy((post) => post.title.asc()).select(
					"title",
				);
				const withPosts = yield* base.include("posts", postTitles);
				const withPostCount = yield* base.include("posts", db.Post.count());
				const firstPostTitle = postTitles.take(1);
				const withPostOverview = yield* base.include("posts", {
					fullCount: db.Post.count(),
					items: firstPostTitle,
					pageCount: firstPostTitle.count(),
				});
				const withPostAuthors = yield* base.include(
					"posts",
					db.Post.include("user"),
				);
				const standaloneTitles = yield* postTitles;
				const wrongModel = db.User as unknown as typeof db.Post;
				const wrongModelExit = yield* Effect.exit(
					base.include("posts", wrongModel),
				);
				const postWithAuthor = yield* db.Post.where({
					id: firstPostId,
				})
					.include("user")
					.include("reviewer")
					.first();
				const withoutPosts = yield* base;

				expect(withPosts).toEqual([
					{
						createdAt: expect.any(Date),
						email: expect.any(String),
						id: userId,
						name: "Relation owner",
						posts: [{ title: "First post" }, { title: "Second post" }],
						verifiedAt: null,
					},
				]);
				expect(withPostCount[0]?.posts).toBe(2);
				expect(withPostOverview[0]?.posts).toEqual({
					fullCount: 2,
					items: [{ title: "First post" }],
					pageCount: 1,
				});
				expect(
					withPostAuthors[0]?.posts.every((post) => post.user.id === userId),
				).toBe(true);
				expect(standaloneTitles).toEqual([
					{ title: "First post" },
					{ title: "Second post" },
				]);
				expect(Exit.isFailure(wrongModelExit)).toBe(true);
				if (Exit.isFailure(wrongModelExit)) {
					expect(Cause.pretty(wrongModelExit.cause)).toContain(
						"Included relation expects Post, received User",
					);
				}
				expect(Option.getOrThrow(postWithAuthor).user.id).toBe(userId);
				expect(Option.getOrThrow(postWithAuthor).reviewer).toBeNull();
				expect(yield* db.Post.where({ userId }).count()).toBe(2);
				expect(withoutPosts).toEqual([
					{
						createdAt: expect.any(Date),
						email: expect.any(String),
						id: userId,
						name: "Relation owner",
						verifiedAt: null,
					},
				]);
			}),
		),
	),
);
