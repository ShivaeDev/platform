import { Effect } from "effect";
import { expectTypeOf } from "vitest";
import { Database } from "#test/support/typed-database.ts";

const program = Effect.gen(function* () {
	const db = yield* Database;

	db.transaction(
		// @ts-expect-error A transaction body must yield Database so queries bind to its transaction implementation.
		db.User.create({
			email: "prebuilt@example.com",
			id: crypto.randomUUID(),
			name: "Prebuilt",
		}),
	);

	// @ts-expect-error Models are generated from the contract.
	db.Movie;
	// @ts-expect-error Unknown fields must not be accepted by object filters.
	db.User.where({ missing: true });
	// @ts-expect-error Filter values retain their database field types.
	db.User.where({ email: 123 });
	// @ts-expect-error Timestamp filters use the Date values accepted by the runtime codec.
	db.User.where({ createdAt: "2026-08-03T00:00:00.000Z" });
	// @ts-expect-error Timestamp-with-time-zone filters also use Date values.
	db.User.where({ verifiedAt: "2026-08-03T00:00:00.000Z" });
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
	db.User.create({ email: "wrong-id@example.com", id: 123, name: "Wrong id" });
	db.User.create({
		// @ts-expect-error Timestamp writes use the Date values accepted by the runtime codec.
		createdAt: "2026-08-03T00:00:00.000Z",
		email: "wrong-timestamp@example.com",
		id: crypto.randomUUID(),
		name: "Wrong timestamp",
	});
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
