import { Effect, type Stream } from "effect";
import { expectTypeOf } from "vitest";
import type { PrismaError } from "#error.ts";
import { Database, type Post, type User } from "#test/typed-database.ts";

const program = Effect.gen(function* () {
	const db = yield* Database;

	const withPosts = db.User.include("posts");
	expectTypeOf(withPosts).not.toBeAny();
	expectTypeOf<Effect.Success<typeof withPosts>>().not.toBeAny();
	expectTypeOf<Effect.Success<typeof withPosts>>().toMatchTypeOf<
		Array<{
			id: string;
			email: string;
			name: string;
			posts: Post[];
		}>
	>();
	expectTypeOf<
		Array<{
			createdAt: Date;
			verifiedAt: Date | null;
			id: string;
			email: string;
			name: string;
			posts: Post[];
		}>
	>().toMatchTypeOf<Effect.Success<typeof withPosts>>();

	const postTitles = db.Post.select("title");
	const withPostTitles = db.User.include("posts", postTitles);
	expectTypeOf(withPostTitles).not.toBeAny();
	expectTypeOf<Effect.Success<typeof withPostTitles>>().toMatchTypeOf<
		Array<{
			id: string;
			email: string;
			name: string;
			posts: Array<{ title: string }>;
		}>
	>();

	const withPostAuthors = db.User.include("posts", db.Post.include("user"));
	expectTypeOf(withPostAuthors).not.toBeAny();
	expectTypeOf<Effect.Success<typeof withPostAuthors>>().toMatchTypeOf<
		Array<{
			id: string;
			email: string;
			name: string;
			posts: Array<Post & { user: User }>;
		}>
	>();

	const withAuthor = db.Post.include("user");
	expectTypeOf(withAuthor).not.toBeAny();
	expectTypeOf<Effect.Success<typeof withAuthor>>().toMatchTypeOf<
		Array<{
			id: string;
			reviewerId: string | null;
			title: string;
			userId: string;
			user: User;
		}>
	>();

	const withReviewer = db.Post.include("reviewer");
	expectTypeOf(withReviewer).not.toBeAny();
	expectTypeOf<Effect.Success<typeof withReviewer>>().toMatchTypeOf<Array<Post & { reviewer: User | null }>>();

	const withPostCount = db.User.include("posts", db.Post.count());
	expectTypeOf(withPostCount).not.toBeAny();
	expectTypeOf<Effect.Success<typeof withPostCount>>().toMatchTypeOf<
		Array<{
			id: string;
			email: string;
			name: string;
			posts: number;
		}>
	>();

	const withPostOverview = db.User.include("posts", {
		fullCount: db.Post.count(),
		items: postTitles,
		pageCount: postTitles.count(),
	});
	expectTypeOf(withPostOverview).not.toBeAny();
	expectTypeOf<Effect.Success<typeof withPostOverview>>().toMatchTypeOf<
		Array<{
			id: string;
			email: string;
			name: string;
			posts: {
				fullCount: number;
				items: Array<{ title: string }>;
				pageCount: number;
			};
		}>
	>();

	const create = db.User.create({
		email: "new@example.com",
		id: crypto.randomUUID(),
		name: "New user",
	});
	expectTypeOf(create).not.toBeAny();
	expectTypeOf<Effect.Success<typeof create>>().toEqualTypeOf<User>();
	expectTypeOf<Effect.Error<typeof create>>().toEqualTypeOf<PrismaError>();
	const createWithTimestamp = db.User.create({
		createdAt: new Date(0),
		email: "timestamped@example.com",
		id: crypto.randomUUID(),
		name: "Timestamped user",
		verifiedAt: new Date(0),
	});
	expectTypeOf<Effect.Success<typeof createWithTimestamp>>().toEqualTypeOf<User>();

	const createAll = db.User.createAll([
		{
			email: "many@example.com",
			id: crypto.randomUUID(),
			name: "Many",
		},
	]);
	expectTypeOf<Effect.Success<typeof createAll>>().toEqualTypeOf<User[]>();

	const aggregate = db.User.aggregate((summary) => ({
		total: summary.count(),
	}));
	expectTypeOf<Effect.Success<typeof aggregate>>().toEqualTypeOf<{
		total: number;
	}>();

	const grouped = db.User.groupBy("name").aggregate((summary) => ({
		total: summary.count(),
	}));
	expectTypeOf<Effect.Success<typeof grouped>>().toEqualTypeOf<Array<{ name: string; total: number }>>();

	const ordered = db.User.orderBy((user) => user.id.asc());
	const cursor = ordered.cursor({ id: crypto.randomUUID() });
	expectTypeOf<Effect.Success<typeof cursor>>().toEqualTypeOf<User[]>();
	const distinct = db.User.distinct("email");
	expectTypeOf<Effect.Success<typeof distinct>>().toEqualTypeOf<User[]>();
	const distinctOn = ordered.distinctOn("id");
	expectTypeOf<Effect.Success<typeof distinctOn>>().toEqualTypeOf<User[]>();

	const filtered = db.User.where({ email: "existing@example.com" });
	const update = filtered.update({ name: "Updated" });
	expectTypeOf<Effect.Success<typeof update>>().toEqualTypeOf<User | null>();
	const updateAll = filtered.updateAll({ name: "Updated" });
	expectTypeOf<Effect.Success<typeof updateAll>>().toEqualTypeOf<User[]>();
	const deleted = filtered.delete();
	expectTypeOf<Effect.Success<typeof deleted>>().toEqualTypeOf<User | null>();
	const deleteAll = filtered.deleteAll();
	expectTypeOf<Effect.Success<typeof deleteAll>>().toEqualTypeOf<User[]>();

	expectTypeOf(db.User.stream).not.toBeAny();
	expectTypeOf<Stream.Success<typeof db.User.stream>>().toEqualTypeOf<User>();
	expectTypeOf<Stream.Error<typeof db.User.stream>>().toEqualTypeOf<PrismaError>();
	expectTypeOf<Stream.Services<typeof db.User.stream>>().toBeNever();
});

expectTypeOf(program).not.toBeAny();
expectTypeOf<Effect.Success<typeof program>>().toEqualTypeOf<void>();

void program;
