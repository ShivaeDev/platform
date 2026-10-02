import { Cause, Effect, Exit, Option } from "effect";
import { expect } from "vitest";
import { withTestTransaction } from "../src/testing.ts";
import { Database, integrationEffect, uniqueEmail, withDatabase } from "./support/postgres-database.ts";

const createNested = (outer: unknown, email: string) =>
	Effect.gen(function* () {
		const inner = yield* Database;
		expect(inner).toBe(outer);
		yield* inner.User.create({
			id: crypto.randomUUID(),
			email,
			name: "Nested",
		});
	});

integrationEffect("owns the client and commits successful transactions", () =>
	withDatabase(
		Effect.gen(function* () {
			const db = yield* Database;
			const email = uniqueEmail("commit");
			const relation = db.User.where({ email });

			const exists = yield* relation.exists();
			expect(exists).toBe(false);

			yield* db.transaction(
				Effect.gen(function* () {
					const transactionDb = yield* Database;
					yield* transactionDb.User.create({
						id: crypto.randomUUID(),
						email,
						name: "Committed",
					});
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

integrationEffect("uses Date values for PostgreSQL timestamps", () =>
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
				expect(yield* db.User.where((row) => row.createdAt.eq(createdAt)).exists()).toBe(true);
			}),
		),
	),
);

integrationEffect("reuses the active transaction for nested boundaries", () =>
	withDatabase(
		Effect.gen(function* () {
			const db = yield* Database;
			const email = uniqueEmail("nested");
			const relation = db.User.where({ email });

			yield* db.transaction(
				Effect.gen(function* () {
					const outer = yield* Database;
					expect(outer).not.toBe(db);
					yield* db.transaction(createNested(outer, email));
				}),
			);

			expect(yield* relation.exists()).toBe(true);
		}),
	),
);

integrationEffect("runs aggregate, grouping, bulk create, update, and delete terminals", () =>
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

				const aggregate = yield* db.User.where({ name: marker }).aggregate((summary) => ({
					total: summary.count(),
				}));
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

integrationEffect("loads related rows without changing the base relation", () =>
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
				const postTitles = db.Post.orderBy((post) => post.title.asc()).select("title");
				const withPosts = yield* base.include("posts", postTitles);
				const withPostCount = yield* base.include("posts", db.Post.count());
				const firstPostTitle = postTitles.take(1);
				const withPostOverview = yield* base.include("posts", {
					fullCount: db.Post.count(),
					items: firstPostTitle,
					pageCount: firstPostTitle.count(),
				});
				const withPostAuthors = yield* base.include("posts", db.Post.include("user"));
				const standaloneTitles = yield* postTitles;
				const wrongModel: Effect.Effect<unknown, unknown> = Reflect.apply(base.include, base, ["posts", db.User]);
				const wrongModelExit = yield* Effect.exit(wrongModel);
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
				expect(withPostAuthors[0]?.posts.every((post) => post.user.id === userId)).toBe(true);
				expect(standaloneTitles).toEqual([{ title: "First post" }, { title: "Second post" }]);
				expect(Exit.isFailure(wrongModelExit)).toBe(true);
				if (Exit.isFailure(wrongModelExit)) {
					expect(Cause.pretty(wrongModelExit.cause)).toContain("Included relation expects Post, received User");
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
