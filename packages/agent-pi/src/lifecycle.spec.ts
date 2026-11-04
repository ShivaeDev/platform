import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { abortFailure, piAgent } from "#test/piStory.ts";

piAgent.it("follow-up and steer reach Pi as distinct delivery modes", [], function* ({ start, queue, steer, requests }) {
	yield* start("alice", "first");
	yield* queue("alice", "later");
	yield* steer("alice", "now");

	expect(yield* requests()).toMatchObject([
		{
			prompts: [
				{ delivery: "steer", text: "first" },
				{ delivery: "followUp", text: "later" },
				{ delivery: "steer", text: "now" },
			],
		},
	]);
});

piAgent.it("abort requests interruption and scope disposal releases the runtime", [], function* ({ start, abort, close, lifecycle }) {
	yield* start("alice", "work");
	yield* abort("alice");
	expect(yield* lifecycle()).toEqual([["abort"]]);

	yield* close();

	expect(yield* lifecycle()).toEqual([["abort", "unsubscribe", "abort", "dispose"]]);
});

piAgent.it("closed scopes leave missing execution evidence while receipts remain reconcilable", [], function* ({ start, inspect, close, reconcile }) {
	yield* start("alice", "work");
	expect(yield* inspect("alice")).toEqual({ state: "running", type: "known" });

	yield* close();

	yield* outcomes([
		["execution evidence", () => inspect("alice"), { type: "missing" }],
		["acceptance evidence", () => reconcile("alice"), { type: "accepted" }],
	]);
});

piAgent.it("disposal still releases Pi when abort fails", [abortFailure], function* ({ start, closeResult, lifecycle }) {
	yield* start("alice", "work");

	yield* closeResult();

	expect(yield* lifecycle()).toEqual([["unsubscribe", "abort", "dispose"]]);
});
