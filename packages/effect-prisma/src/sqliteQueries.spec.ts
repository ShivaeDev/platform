import { Cause, Effect, Exit, Option } from "effect";
import { expect } from "vitest";
import { Database, uniqueEmail } from "#test/sqlite/database.ts";
import { rollbackWrites, sqliteStory } from "#test/sqlite/story.ts";

sqliteStory.it("runs aggregate, grouping, bulk create, update, and delete terminals", [rollbackWrites()], function* ({ transact }) {
	return yield* transact(
		Effect.gen(function* () {
			const db = yield* Database;
			const marker = crypto.randomUUID();
			const users = [
				{
					email: `${marker}-one@example.test`,
					id: crypto.randomUUID(),
					name: marker,
				},
				{
					email: `${marker}-two@example.test`,
					id: crypto.randomUUID(),
					name: marker,
				},
			];
			const created = yield* db.User.createAll(users);
			expect(created).toMatchObject(users);

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
			expect(updated).toMatchObject(users.map((user) => ({ ...user, name: `${marker}-updated` })));

			const deleted = yield* db.User.where({
				name: `${marker}-updated`,
			}).deleteAll();
			expect(deleted).toMatchObject(users.map((user) => ({ ...user, name: `${marker}-updated` })));
		}),
	);
});

sqliteStory.it("loads related rows without changing the base relation", [rollbackWrites()], function* ({ transact }) {
	return yield* transact(
		Effect.gen(function* () {
			const db = yield* Database;
			const userId = crypto.randomUUID();
			const firstPostId = crypto.randomUUID();
			yield* db.User.create({
				email: uniqueEmail("include"),
				id: userId,
				name: "Relation owner",
			});
			const posts = [
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
			];
			yield* db.Post.createAll(posts);

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
			expect(withPostCount[0]?.posts).toBe(posts.length);
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
			expect(yield* db.Post.where({ userId }).count()).toBe(posts.length);
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
	);
});
