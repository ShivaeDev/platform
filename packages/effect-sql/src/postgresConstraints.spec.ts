import { Effect, Result } from "effect";
import { expect } from "vitest";
import { namedUniqueViolation } from "#test/constrainedItems.ts";
import { hasConstrainedItems } from "#test/repositoryTraits.ts";
import { postgres } from "#test/sqlStory.ts";

postgres.it(
	"known unique constraints become domain failures after rollback; other SQL failures remain intact",
	[hasConstrainedItems()],
	function* ({ sql, constrainedItems }) {
		const { items, unique } = constrainedItems();
		yield* items.insert({ name: "Original", quantity: 1 });
		const duplicateProgram = Effect.gen(function* () {
			yield* items.insert({ name: "Must roll back", quantity: 2 });
			return yield* items.insert({ name: "Original", quantity: 3 });
		});
		const duplicate = yield* sql.withTransaction(duplicateProgram).pipe(Effect.catchTag("SqlError", namedUniqueViolation(unique)), Effect.result);
		expect(Result.isFailure(duplicate) && duplicate.failure._tag).toBe("NameTaken");
		expect(yield* items.findMany({ select: ["name", "quantity"] })).toEqual([{ name: "Original", quantity: 1 }]);
		const invalid = yield* sql
			.withTransaction(items.insert({ name: "Invalid", quantity: -1 }))
			.pipe(Effect.catchTag("SqlError", namedUniqueViolation(unique)), Effect.result);
		if (!Result.isFailure(invalid) || invalid.failure._tag !== "SqlError") {
			throw new Error("Expected the original SQL failure");
		}
		expect(invalid.failure.reason._tag).toBe("ConstraintError");
		expect(invalid.failure.isRetryable).toBe(false);
		expect(yield* items.findMany({ select: ["name"] })).toEqual([{ name: "Original" }]);
	},
);
