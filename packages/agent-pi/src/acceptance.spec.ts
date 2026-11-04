import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { heldPreflight, noSessionFile, piAgent, refused, unknownAcceptance } from "#test/piStory.ts";

piAgent.it(
	"successful preflight returns a receipt and matching acknowledgement before completion",
	[],
	function* ({ start, receipt, completion, reconcile, events }) {
		yield* start("alice", "build it");
		const accepted = yield* receipt("alice");

		yield* outcomes([
			["session file", () => receipt("alice"), { session: { value: expect.stringMatching(/\.jsonl$/u), version: 1 } }],
			["completion", () => completion("alice"), "pending"],
			["reconciliation", () => reconcile("alice"), { receipt: accepted, type: "accepted" }],
			[
				"opening events",
				() => events("alice", "opening"),
				[
					{ reference: accepted.reference.value, type: "session.opened" },
					{ receipt: accepted, type: "acknowledged" },
				],
			],
		]);
	},
);

piAgent.it("preflight refusal remains authoritative non-acceptance", [refused], function* ({ start, result, reconcile }) {
	yield* start("alice", "work");

	yield* outcomes([
		["submission", () => result("alice"), "rejected: provider refused text"],
		["reconciliation", () => reconcile("alice"), { evidence: "provider refused text", operationId: "alice", type: "not-accepted" }],
	]);
});

piAgent.it("failure without preflight evidence preserves uncertainty", [unknownAcceptance], function* ({ start, result, reconcile }) {
	yield* start("alice", "work");

	yield* outcomes([
		["submission", () => result("alice"), "uncertain: alice"],
		["reconciliation", () => reconcile("alice"), { operationId: "alice", type: "uncertain" }],
	]);
});

piAgent.it("an attempted operation cannot submit replacement work", [], function* ({ start, result, requests }) {
	yield* start("alice", "first");
	yield* start("alice", "second");

	yield* outcomes([
		["duplicate submission", () => result("alice"), "protocol: operation already attempted; reconcile instead"],
		["provider requests", () => requests(), [{ prompts: [{ text: "first" }] }]],
	]);
});

piAgent.it("missing recovery evidence stays uncertain without provider work", [], function* ({ reconcile, requests }) {
	yield* outcomes([
		["reconciliation", () => reconcile("alice"), { operationId: "alice", type: "uncertain" }],
		["provider requests", () => requests(), []],
	]);
});

piAgent.it("held preflight stays uncertain until Pi accepts the submission", [heldPreflight], function* ({ begin, reconcile, accept, join }) {
	yield* begin("alice", "work");
	expect(yield* reconcile("alice")).toMatchObject({ type: "uncertain" });

	yield* accept("alice");

	expect(yield* join("alice")).toMatchObject({ backend: "pi", operationId: "alice" });
});

piAgent.it(
	"an unpersisted SDK session is refused and released before start returns",
	[noSessionFile],
	function* ({ start, result, lifecycle, requests }) {
		yield* start("alice", "work");

		yield* outcomes([
			["submission", () => result("alice"), "unavailable: Pi opened a session without a persisted file reference"],
			["runtime release", () => lifecycle(), [["abort", "dispose"]]],
			["prompt delivery", () => requests(), [{ prompts: [] }]],
		]);
	},
);
