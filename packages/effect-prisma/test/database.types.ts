import type { ExtractFieldOutputTypes } from "@prisma-next/sql-contract/types";
import { Effect, type Option, type Stream } from "effect";
import { expectTypeOf } from "vitest";
import { makeDatabase, type PrismaError } from "../src/index.js";
import { makeDatabaseIt } from "../src/testing.js";
import { type Contract, contractJson } from "./contract.js";

type User = {
	id: string;
	email: string;
	name: string;
};

type Post = {
	id: string;
	reviewerId: string | null;
	title: string;
	userId: string;
};

type ContractEmail =
	ExtractFieldOutputTypes<Contract>["public"]["User"]["email"];
expectTypeOf<ContractEmail>().toEqualTypeOf<string>();
type IsAny<Value> = 0 extends 1 & Value ? true : false;
type Assert<Condition extends true> = Condition;
type _ContractEmailIsNotAny = Assert<
	IsAny<ContractEmail> extends false ? true : false
>;
type _ContractEmailIsString = Assert<
	ContractEmail extends string ? true : false
>;

const Database = makeDatabase<Contract>("@test/Database", { contractJson });
const databaseIt = makeDatabaseIt({
	database: Database,
	layer: Database.layer({
		url: "postgresql://compile-only",
	}),
});

databaseIt.effectDB("retains generated model types", function* (db, context) {
	expectTypeOf(db).not.toBeAny();
	expectTypeOf(db.User).not.toBeAny();
	expectTypeOf(context).not.toBeAny();

	const user = yield* db.User.where({ email: "typed@example.test" }).first();
	expectTypeOf(user).toEqualTypeOf<Option.Option<User>>();

	// @ts-expect-error The test facade must reject models absent from the contract.
	db.Movie;
	// @ts-expect-error The test facade must preserve field input types.
	db.User.where({ email: 123 });
});

const program = Effect.gen(function* () {
	const db = yield* Database;

	expectTypeOf(db).not.toBeAny();
	expectTypeOf(db.User).not.toBeAny();

	const allUsers = yield* db.User;
	expectTypeOf(allUsers).not.toBeAny();
	expectTypeOf(allUsers).toEqualTypeOf<Array<User>>();

	const byObject = db.User.where({ email: "hello@example.com" });
	expectTypeOf(byObject).not.toBeAny();
	expectTypeOf<Effect.Success<typeof byObject>>().not.toBeAny();
	expectTypeOf<Effect.Success<typeof byObject>>().toEqualTypeOf<Array<User>>();
	expectTypeOf<Effect.Error<typeof byObject>>().toEqualTypeOf<PrismaError>();
	expectTypeOf<Effect.Services<typeof byObject>>().not.toBeAny();
	expectTypeOf<Effect.Services<typeof byObject>>().not.toBeNever();

	const byCallback = db.User.where((user) => {
		expectTypeOf(user).not.toBeAny();
		expectTypeOf(user.email).not.toBeAny();
		return user.email.eq("hello@example.com");
	});
	expectTypeOf(byCallback).not.toBeAny();

	const deeplyComposed = db.User.where({ name: "Ada" })
		.where((user) => user.email.eq("ada@example.com"))
		.orderBy((user) => user.name.asc())
		.take(25)
		.select("id", "email");

	expectTypeOf(deeplyComposed).not.toBeAny();
	expectTypeOf<Effect.Success<typeof deeplyComposed>>().not.toBeAny();
	expectTypeOf<Effect.Success<typeof deeplyComposed>>().toEqualTypeOf<
		Array<{
			id: string;
			email: string;
		}>
	>();

	const recursivelyComposed = db.User.where({ name: "Ada" })
		.where((user) => user.email.eq("ada@example.com"))
		.orderBy((user) => user.name.asc())
		.where((user) => user.id.eq(crypto.randomUUID()))
		.take(100)
		.where({ email: "ada@example.com" })
		.orderBy((user) => user.email.desc())
		.where((user) => user.name.neq("Grace"))
		.take(50)
		.where({ name: "Ada" })
		.orderBy((user) => user.id.asc())
		.take(25);
	expectTypeOf(recursivelyComposed).not.toBeAny();
	expectTypeOf<Effect.Success<typeof recursivelyComposed>>().toEqualTypeOf<
		Array<User>
	>();

	yield* byObject;
	yield* byCallback;

	const first = yield* byObject.first();
	expectTypeOf(first).not.toBeAny();
	expectTypeOf(first).toEqualTypeOf<Option.Option<User>>();

	const exists = yield* byObject.exists();
	expectTypeOf(exists).not.toBeAny();
	expectTypeOf(exists).toEqualTypeOf<boolean>();

	const count = yield* byObject.count();
	expectTypeOf(count).not.toBeAny();
	expectTypeOf(count).toEqualTypeOf<number>();

	const selected = yield* db.User.select("id", "email");
	expectTypeOf(selected).not.toBeAny();
	expectTypeOf(selected).toEqualTypeOf<
		Array<{
			id: string;
			email: string;
		}>
	>();

	const selectedRow = selected[0];
	if (selectedRow !== undefined) {
		expectTypeOf(selectedRow.id).toEqualTypeOf<string>();
		// @ts-expect-error A selected row must not silently retain omitted fields.
		selectedRow.name;
	}

	const withPosts = db.User.include("posts");
	expectTypeOf(withPosts).not.toBeAny();
	expectTypeOf<Effect.Success<typeof withPosts>>().not.toBeAny();
	expectTypeOf<Effect.Success<typeof withPosts>>().toMatchTypeOf<
		Array<{
			id: string;
			email: string;
			name: string;
			posts: Array<Post>;
		}>
	>();
	expectTypeOf<
		Array<{ id: string; email: string; name: string; posts: Array<Post> }>
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
	expectTypeOf<Effect.Success<typeof withReviewer>>().toMatchTypeOf<
		Array<Post & { reviewer: User | null }>
	>();

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
		id: crypto.randomUUID(),
		email: "new@example.com",
		name: "New user",
	});
	expectTypeOf(create).not.toBeAny();
	expectTypeOf<Effect.Success<typeof create>>().toEqualTypeOf<User>();
	expectTypeOf<Effect.Error<typeof create>>().toEqualTypeOf<PrismaError>();

	const createAll = db.User.createAll([
		{
			id: crypto.randomUUID(),
			email: "many@example.com",
			name: "Many",
		},
	]);
	expectTypeOf<Effect.Success<typeof createAll>>().toEqualTypeOf<Array<User>>();

	const aggregate = db.User.aggregate((summary) => ({
		total: summary.count(),
	}));
	expectTypeOf<Effect.Success<typeof aggregate>>().toEqualTypeOf<{
		total: number;
	}>();

	const grouped = db.User.groupBy("name").aggregate((summary) => ({
		total: summary.count(),
	}));
	expectTypeOf<Effect.Success<typeof grouped>>().toEqualTypeOf<
		Array<{ name: string; total: number }>
	>();

	const ordered = db.User.orderBy((user) => user.id.asc());
	const cursor = ordered.cursor({ id: crypto.randomUUID() });
	expectTypeOf<Effect.Success<typeof cursor>>().toEqualTypeOf<Array<User>>();
	const distinct = db.User.distinct("email");
	expectTypeOf<Effect.Success<typeof distinct>>().toEqualTypeOf<Array<User>>();
	const distinctOn = ordered.distinctOn("id");
	expectTypeOf<Effect.Success<typeof distinctOn>>().toEqualTypeOf<
		Array<User>
	>();

	const filtered = db.User.where({ email: "existing@example.com" });
	const update = filtered.update({ name: "Updated" });
	expectTypeOf<Effect.Success<typeof update>>().toEqualTypeOf<User | null>();
	const updateAll = filtered.updateAll({ name: "Updated" });
	expectTypeOf<Effect.Success<typeof updateAll>>().toEqualTypeOf<Array<User>>();
	const deleted = filtered.delete();
	expectTypeOf<Effect.Success<typeof deleted>>().toEqualTypeOf<User | null>();
	const deleteAll = filtered.deleteAll();
	expectTypeOf<Effect.Success<typeof deleteAll>>().toEqualTypeOf<Array<User>>();

	expectTypeOf(db.User.stream).not.toBeAny();
	expectTypeOf<Stream.Success<typeof db.User.stream>>().toEqualTypeOf<User>();
	expectTypeOf<
		Stream.Error<typeof db.User.stream>
	>().toEqualTypeOf<PrismaError>();
	expectTypeOf<Stream.Services<typeof db.User.stream>>().not.toBeAny();

	// @ts-expect-error Models are generated from the contract.
	db.Movie;
	// @ts-expect-error Unknown fields must not be accepted by object filters.
	db.User.where({ missing: true });
	// @ts-expect-error Filter values retain their database field types.
	db.User.where({ email: 123 });
	// @ts-expect-error Callback accessors retain their database field types.
	db.User.where((user) => user.email.eq(123));
	// @ts-expect-error Selections are constrained to actual model fields.
	db.User.select("missing");
	// @ts-expect-error Includes are constrained to actual model relations.
	db.User.include("missing");
	// @ts-expect-error Included queries must use the related model.
	db.User.include("posts", db.User);
	// @ts-expect-error Every named query must use the related model.
	db.User.include("posts", { items: db.Post, wrong: db.User });
	// @ts-expect-error Named query records must include at least one query.
	db.User.include("posts", {});
	// @ts-expect-error Named query records require a to-many relation.
	db.Post.include("user", { item: db.User });
	// @ts-expect-error Create input fields retain their database field types.
	db.User.create({ id: 123, email: "wrong-id@example.com", name: "Wrong id" });
	// @ts-expect-error Unsafe whole-collection updates are rejected by Prisma state typing.
	db.User.update({ name: "Unsafe" });
	// @ts-expect-error Cursors require an explicit stable ordering.
	db.User.cursor({ id: crypto.randomUUID() });
	// @ts-expect-error Distinct-on requires an explicit stable ordering.
	db.User.distinctOn("id");
	// @ts-expect-error Unsafe whole-collection deletes are rejected by Prisma state typing.
	db.User.delete();
	// @ts-expect-error Bulk deletes also require an explicit filter.
	db.User.deleteAll();
	// @ts-expect-error Count-only deletes also require an explicit filter.
	db.User.deleteCount();
});

expectTypeOf(program).not.toBeAny();
expectTypeOf<Effect.Success<typeof program>>().toEqualTypeOf<void>();

void program;
