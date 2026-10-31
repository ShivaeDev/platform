import { describe, expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { deliveryObservationFailsOnce } from "#test/engineAreaTraits.ts";
import { engine } from "#test/engineStory.ts";
import { humanMergeRequired, providerReusesOperationIdentity } from "#test/engineTraits.ts";
import { prepared } from "#test/preparation.ts";
import { refusal } from "#test/refusal.ts";

describe("Fleet delivery ownership", () => {
	engine.it(
		"failed delivery observation keeps the work on automation and recovers without a human retry",
		[deliveryObservationFailsOnce()],
		function* ({ advanceTime, currentTime, finishWorkers, fleet, mergedHeads, prepareWork, reviewedHeads }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			const ambiguous = (yield* fleet.reconcile("one")).value;
			expect({
				blocker: ambiguous.blocker,
				decision: ambiguous.decision?.code ?? "none",
				owner: ambiguous.attentionOwner,
				step: ambiguous.step,
			}).toEqual({
				blocker: expect.stringContaining("observation unavailable"),
				decision: "none",
				owner: "automation",
				step: "delivering",
			});
			advanceTime(30_100 - currentTime());

			const recovered = yield* fleet.reconcile("one");

			expect({ merged: mergedHeads(), reviewed: reviewedHeads(), step: recovered.value.step }).toEqual({
				merged: [ambiguous.result?.head],
				reviewed: [ambiguous.result?.head],
				step: "done",
			});
		},
	);

	engine.it(
		"safe local release keeps the adopted PR in the foreign backlog without blocking its paths",
		[humanMergeRequired()],
		function* ({ answerDecision, finishWorkers, fleet, foreignReservations, prepareWork }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			yield* fleet.reconcile("one");

			yield* answerDecision("one", "release");

			yield* fleet.prepare({ cwd: "/synthetic", preparation: prepared({ ownedPaths: ["src/one.ts"] }), prompt: "Same scope", workId: "two" });
			yield* outcomes([
				[
					"foreign reservations",
					() => foreignReservations(),
					[{ areas: [], backlog: true, executing: false, owner: "https://example.invalid/pr/one" }],
				],
				["two once dispatched with the same paths", () => fleet.dispatch("two"), { value: { step: "working" } }],
			]);
		},
	);

	engine.it(
		"a reused operation identity cannot acknowledge the wrong work's turn",
		[providerReusesOperationIdentity()],
		function* ({ fleet, prepareWork, providerOperations }) {
			yield* prepareWork("one");
			yield* prepareWork("two");
			yield* fleet.dispatch("one");

			const two = yield* fleet.dispatch("two");

			expect({ operations: providerOperations(), receipt: two.value.attempts[0]?.receipt ?? "no receipt" }).toEqual({
				operations: ["operation-fixed"],
				receipt: "no receipt",
			});
		},
	);

	engine.it(
		"a persisted acknowledgement refuses a replacement session or turn identity and keeps its receipt",
		[],
		function* ({ acknowledgeProviderTurn, fleet, prepareWork }) {
			yield* prepareWork("one");
			const attempt = (yield* fleet.dispatch("one")).value.attempts[0];

			const replaced = yield* refusal(
				acknowledgeProviderTurn(attempt?.operationId ?? "missing", { sessionId: "another-session", turnId: "another-turn" }),
			);

			expect({ receipt: (yield* fleet.get("one")).value.attempts[0]?.receipt, replaced }).toEqual({
				receipt: attempt?.receipt,
				replaced: expect.stringMatching(/^session persistence/u),
			});
		},
	);
});
