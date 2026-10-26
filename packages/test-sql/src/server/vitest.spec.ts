import { expect } from "vitest";
import { database } from "#test/database.ts";

database.it(
	"the Vitest consumer rolls back its harness, body and finalizers while clones commit independently",
	[],
	function* (test) {
		const result = yield* test.runConsumer();
		expect(result.errors).toEqual([]);
		expect(result.tests).toEqual([
			{
				errors: [],
				observed: { acquisition: [{ value: "seed" }], body: [{ value: "body" }, { value: "harness" }] },
				state: "passed",
			},
			{
				errors: [],
				observed: {
					acquisition: [{ value: "seed" }],
					body: [{ value: "seed" }, { value: "harness" }],
					counts: { fixtures: 1, migrations: 1 },
				},
				state: "passed",
			},
			{
				errors: [],
				observed: {
					body: [{ value: "seed" }, { value: "harness" }],
					counts: { fixtures: 1, migrations: 1 },
					isolated: { initial: [{ value: "seed" }], transactionPresent: false, visibleToOtherConnection: [{ value: "committed" }] },
				},
				state: "passed",
			},
		]);
	},
	30_000,
);
