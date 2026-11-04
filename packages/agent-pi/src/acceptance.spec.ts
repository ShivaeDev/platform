import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { handled, heldPreflight, noSessionFile, piAgent, refused, unknownAcceptance } from "#test/piStory.ts";

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

piAgent.it("a rejected prompt without a disposition remains authoritative non-acceptance", [refused], function* ({ start, result, reconcile }) {
	yield* start("alice", "work");

	yield* outcomes([
		["submission", () => result("alice"), "rejected: provider refused text"],
		["reconciliation", () => reconcile("alice"), { evidence: "provider refused text", operationId: "alice", type: "not-accepted" }],
	]);
});

piAgent.it("prompt resolution without a disposition preserves uncertainty", [unknownAcceptance], function* ({ start, result, reconcile }) {
	yield* start("alice", "work");

	yield* outcomes([
		["submission", () => result("alice"), "uncertain: alice"],
		["reconciliation", () => reconcile("alice"), { operationId: "alice", type: "uncertain" }],
	]);
});

piAgent.it("a handled prompt is accepted and completes without a run", [handled], function* ({ start, result, reconcile, inspect, events }) {
	yield* start("alice", "/handled");

	yield* outcomes([
		["submission", () => result("alice"), "accepted"],
		["reconciliation", () => reconcile("alice"), { type: "accepted" }],
		["execution evidence", () => inspect("alice"), { state: "completed", type: "known" }],
		["execution events", () => events("alice", "execution"), [{ state: "completed" }]],
	]);
});

piAgent.it("handled input leaves an active run open", [handled], function* ({ start, steer, inspect, events }) {
	yield* start("alice", "work");

	yield* steer("alice", "/handled");

	yield* outcomes([
		["execution evidence", () => inspect("alice"), { state: "running", type: "known" }],
		["execution events", () => events("alice", "execution"), [{ state: "running" }]],
	]);
});

piAgent.it("queued input leaves an active run open", [], function* ({ start, queue, inspect, events }) {
	yield* start("alice", "work");

	yield* queue("alice", "later");

	yield* outcomes([
		["execution evidence", () => inspect("alice"), { state: "running", type: "known" }],
		["execution events", () => events("alice", "execution"), [{ state: "running" }]],
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
