import { Effect } from "effect";
import { expect } from "vitest";
import { hasConstrainedItems } from "#test/repositoryTraits.ts";
import { postgres } from "#test/sqlStory.ts";

postgres.it(
	"a losing insert maps its unique violation after rollback and can read the winner",
	[hasConstrainedItems()],
	function* ({ constrainedItems, transact, raceWithLock }) {
		const { items, onSqlError } = constrainedItems();

		const results = yield* raceWithLock({
			effects: [
				Effect.gen(function* () {
					yield* items.insert({ name: "Must roll back", quantity: 2 });
					return yield* items.insert({ name: "Shared", quantity: 3 });
				}).pipe(transact({ onSqlError })),
			],
			lock: items.insert({ name: "Shared", quantity: 1 }),
			release: "commit",
		});

		const [rejected] = results;
		if (rejected === undefined) {
			return yield* Effect.die("Missing losing insert result");
		}
		const [winningRow] = yield* items.findMany({ where: { name: "Shared" } });
		expect(rejected).toMatchObject({ _tag: "Failure", failure: { _tag: "NameTaken" } });
		const recovered = yield* Effect.fromResult(rejected).pipe(Effect.catchTag("NameTaken", () => items.findMany({ where: { name: "Shared" } })));
		expect(recovered).toEqual([winningRow]);
		expect(yield* items.findMany()).toEqual([winningRow]);
	},
);
