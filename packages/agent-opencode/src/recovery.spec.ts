import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { lostAcknowledgement, openCode, refusedPrompt } from "#test/opencodeStory.ts";

openCode.it("a lost prompt acknowledgement preserves uncertainty during reconciliation", [lostAcknowledgement], function* ({ start, reconcile }) {
	const outcome = yield* start("alice", "build it");
	expect(outcome).toEqual({ operationId: "alice", outcome: "acceptance unknown" });
	expect(yield* reconcile("alice")).toMatchObject({ operationId: "alice", type: "uncertain" });
});
openCode.it("an explicit prompt refusal remains a typed rejection", [refusedPrompt], function* ({ start }) {
	const outcome = yield* start("alice", "build it");
	expect(outcome).toEqual({ outcome: "refused", providerCode: "400" });
});

openCode.it(
	"a disconnect ends live evidence and refuses input still queued locally",
	[],
	function* ({ start, queue, closeEvents, events, inspect, deliveryResult }) {
		yield* start("alice", "first");
		yield* queue("alice", "never sent");

		yield* closeEvents();
		yield* events("alice");

		yield* outcomes([
			["execution evidence", () => inspect("alice"), { reason: "provider event stream ended without terminal evidence", type: "missing" }],
			["queued delivery", () => deliveryResult("never sent"), "session closed before delivery reached the provider"],
		]);
	},
);
