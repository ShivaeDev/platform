import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { engine } from "#test/engineStory.ts";
import { failedBoardAcknowledgement } from "#test/engineTraits.ts";
import { QUESTION } from "#test/workerQuestion.ts";

engine.it(
	"continuation archives owner and supersession receipts without copying them into the new cycle",
	[failedBoardAcknowledgement],
	function* ({ acknowledgements, workerQuestion, prepareWork, fleet }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		yield* workerQuestion("one", QUESTION);
		const oldStopped = yield* fleet.reconcile("one");
		const oldDecision = oldStopped.value.decision;
		if (oldDecision?.published === undefined) {
			return yield* Effect.die("Missing published worker question");
		}
		const old = { decision: oldDecision, published: oldDecision.published, stopped: oldStopped };
		const reassigned = yield* fleet.reassign("one", old.decision.id, "maintainer");
		expect(reassigned.value.blocker).toContain("Board request acknowledgement pending");
		const continued = yield* fleet.continue("one", "Continue the current work");
		expect(continued.value.attentionOwner).toBeUndefined();
		expect(continued.value.supersededDecisions).toBeUndefined();
		expect(continued.value.history?.[0]).toMatchObject({
			attentionOwner: "maintainer",
			decision: { attentionOwner: "maintainer", id: reassigned.value.decision?.id },
			supersededDecisions: [{ published: old.published }],
		});
		const reconciled = yield* fleet.reconcile("one");
		expect(reconciled.value.history?.[0]?.supersededDecisions?.[0]?.boardAcknowledged).toBe(true);
		expect(reconciled.value.history?.[0]?.decisionAcknowledged).toBe(true);
		expect(acknowledgements()).toMatchObject([
			{ decision: old.published, disposition: "superseded" },
			{ decision: reassigned.value.decision?.published, disposition: "superseded" },
		]);
		expect(acknowledgements().filter((acknowledgement) => acknowledgement.decision.request === old.decision.id)).toMatchObject([
			{ decision: old.published, disposition: "superseded" },
		]);
	},
);
