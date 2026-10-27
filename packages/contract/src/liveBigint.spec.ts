import { Effect } from "effect";
import { expect } from "vitest";
import { eventually } from "@shivaedev/test/eventually.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { bigintStory } from "#test/bigintStory.ts";

bigintStory.it("bigint inputs share equal query atoms and receive live changes", [], function* (test) {
	const first = test.query(1n);
	const equal = test.query(1n);
	const second = test.query(2n);
	expect(equal).toBe(first);
	expect(second).not.toBe(first);
	test.watch(first);
	test.watch(equal);
	test.watch(second);
	test.connect();
	yield* eventually(
		outcomes({
			"first record": [test.value(first), "First"],
			"second record": [test.value(second), "Second"],
			"shared subscription": [
				test.subscriptions(),
				[
					[
						{ payload: { id: 1n }, query: "get" },
						{ payload: { id: 2n }, query: "get" },
					],
				],
			],
		}).pipe(Effect.sandbox),
		{ timeout: "5 seconds" },
	);
	yield* test.store(1n, "Changed");
	yield* test.announce(1n);
	yield* eventually(
		outcomes({
			"changed record": [test.value(first), "Changed"],
			"equal query": [test.value(equal), "Changed"],
			"other record": [test.value(second), "Second"],
		}).pipe(Effect.sandbox),
		{ timeout: "5 seconds" },
	);
});
