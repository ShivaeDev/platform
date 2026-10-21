import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { deliveryObservationFailsOnce } from "#test/engineAreaTraits.ts";
import { engine } from "#test/engineStory.ts";
import { humanMergeRequired, providerReusesOperationIdentity } from "#test/engineTraits.ts";
import { prepared } from "#test/preparation.ts";

describe("Fleet delivery ownership", () => {
	engine.it(
		"failed delivery observation retains ownership and recovers without a human retry",
		[deliveryObservationFailsOnce()],
		function* ({ fleet, prepareWork, finishWorkers, advanceTime, currentTime, mergedHeads, reviewedHeads }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			const ambiguous = yield* fleet.reconcile("one");
			expect(ambiguous.value.step).toBe("delivering");
			expect(ambiguous.value.decision).toBeUndefined();
			expect(ambiguous.value.blocker).toContain("observation unavailable");
			expect(ambiguous.value.attentionOwner).toBe("automation");
			advanceTime(30_100 - currentTime());
			expect((yield* fleet.reconcile("one")).value.step).toBe("done");
			expect(mergedHeads()).toHaveLength(1);
			expect(reviewedHeads()).toHaveLength(1);
		},
	);
	engine.it(
		"safe local release keeps the adopted PR in the foreign backlog without blocking its paths",
		[humanMergeRequired()],
		function* ({ fleet, prepareWork, finishWorkers, respond, foreignReservations }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			const denied = yield* fleet.reconcile("one");
			yield* fleet.resolve("one", denied.value.decision?.id ?? "missing", respond(denied.value.decision?.id ?? "missing", "release"));
			expect(yield* foreignReservations()).toEqual([{ areas: [], backlog: true, executing: false, owner: "https://example.invalid/pr/one" }]);
			yield* fleet.prepare({ cwd: "/synthetic", preparation: prepared({ ownedPaths: ["src/one.ts"] }), prompt: "Same scope", workId: "two" });
			expect((yield* fleet.dispatch("two")).value.step).toBe("working");
		},
	);
	engine.it(
		"duplicate operation identity cannot acknowledge the wrong work's turn",
		[providerReusesOperationIdentity()],
		function* ({ fleet, prepareWork, providerOperationCount }) {
			yield* prepareWork("one");
			yield* prepareWork("two");
			yield* fleet.dispatch("one");
			yield* fleet.dispatch("two");
			expect((yield* fleet.get("two")).value.attempts[0]?.receipt).toBeUndefined();
			expect(providerOperationCount()).toBe(1);
		},
	);
	engine.it(
		"persisted acknowledgement rejects a replacement session or turn identity",
		[],
		function* ({ fleet, prepareWork, acknowledgeProviderTurn }) {
			yield* prepareWork("one");
			const submitted = yield* fleet.dispatch("one");
			const attempt = submitted.value.attempts[0];
			expect(attempt).toBeDefined();
			expect(
				yield* Effect.flip(acknowledgeProviderTurn(attempt?.operationId ?? "missing", { sessionId: "another-session", turnId: "another-turn" })),
			).toMatchObject({ _tag: "SessionFailure", reason: "persistence" });
			expect((yield* fleet.get("one")).value.attempts[0]?.receipt).toEqual(attempt?.receipt);
		},
	);
});
