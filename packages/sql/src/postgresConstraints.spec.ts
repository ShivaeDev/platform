import { Effect } from "effect";
import { expect } from "vitest";
import { hasConstrainedItems } from "#test/repositoryTraits.ts";
import { postgres } from "#test/sqlStory.ts";

postgres.it(
	"a named unique violation becomes a domain error after all writes roll back",
	[hasConstrainedItems()],
	function* ({ constrainedItems, transact }) {
		const { items, onSqlError } = constrainedItems();
		yield* items.insert({ name: "Original", quantity: 1 });
		const duplicate = yield* Effect.gen(function* () {
			yield* items.insert({ name: "Must roll back", quantity: 2 });
			return yield* items.insert({ name: "Original", quantity: 3 });
		}).pipe(transact({ onSqlError }), Effect.flip);
		expect(duplicate._tag).toBe("NameTaken");
		expect(yield* items.findMany({ select: ["name", "quantity"] })).toEqual([{ name: "Original", quantity: 1 }]);
	},
);

postgres.it(
	"named foreign-key and check violations map to distinct domain errors",
	[hasConstrainedItems()],
	function* ({ constrainedItems, transact }) {
		const { items, onSqlError } = constrainedItems();
		const foreign = yield* items.insert({ name: "Orphan", parentId: -1, quantity: 1 }).pipe(transact({ onSqlError }), Effect.flip);
		const check = yield* items.insert({ name: "Invalid", quantity: -1 }).pipe(transact({ onSqlError }), Effect.flip);
		expect(foreign._tag).toBe("ParentMissing");
		expect(check._tag).toBe("InvalidQuantity");
		expect(yield* items.findMany()).toEqual([]);
	},
);

postgres.it(
	"a constraint named past 63 bytes maps by the name PostgreSQL truncated it to",
	[hasConstrainedItems()],
	function* ({ constrainedItems, transact }) {
		const { items, onSqlError } = constrainedItems();
		const tooLong = yield* items.insert({ name: "n".repeat(41), quantity: 1 }).pipe(transact({ onSqlError }), Effect.flip);
		expect(tooLong._tag).toBe("NameTooLong");
		expect(yield* items.findMany()).toEqual([]);
	},
);

postgres.it(
	"plain Effect pipelines map SQL failures and send other constraints to the fallback",
	[hasConstrainedItems()],
	function* ({ constrainedItems, sql }) {
		const { items, onSqlError, tableName } = constrainedItems();
		const check = yield* sql`insert into ${sql(tableName)} (name, quantity) values ('Invalid', -1)`.pipe(Effect.mapError(onSqlError), Effect.flip);
		const notNull = yield* sql`insert into ${sql(tableName)} (name) values ('Missing quantity')`.pipe(Effect.mapError(onSqlError), Effect.flip);
		const syntax = yield* sql`select nonexistent_column from ${sql(tableName)}`.pipe(Effect.mapError(onSqlError), Effect.flip);
		expect(check._tag).toBe("InvalidQuantity");
		expect(notNull._tag).toBe("StorageUnavailable");
		expect(syntax._tag).toBe("StorageUnavailable");
		expect(yield* items.findMany()).toEqual([]);
	},
);
