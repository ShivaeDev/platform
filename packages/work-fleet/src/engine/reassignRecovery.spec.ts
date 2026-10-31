import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { boardAcknowledgementFailsOnce } from "#test/engineLifecycleTraits.ts";
import { simultaneousDecisionWrites } from "#test/engineRaceTraits.ts";
import { isolatedEngine } from "#test/engineStory.ts";
import { refusal } from "#test/refusal.ts";

const CONFLICT = expect.stringMatching(/^conflict: /u);

isolatedEngine.it(
	"reassignment recovers a failed supersession acknowledgement after a restart without publishing another question",
	[boardAcknowledgementFailsOnce()],
	function* ({ acknowledgements, afterRestart, askWorker, fleet, launches, prepareWork, publishedDecisions }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		const old = yield* askWorker();
		const changed = yield* fleet.reassign("one", old.decision.id, "maintainer");
		expect(changed.value).toMatchObject({ attentionOwner: "maintainer", blocker: expect.stringContaining("Board request acknowledgement pending") });
		expect(changed.value.supersededDecisions?.[0]?.boardAcknowledged).toBeUndefined();
		const id = changed.value.decision?.id ?? "missing";

		yield* afterRestart(
			Effect.gen(function* () {
				const restarted = yield* Fleet;
				const retried = yield* restarted.reassign("one", old.decision.id, "maintainer");
				expect(retried.value.decision?.id).toBe(id);
				const recovered = yield* restarted.reconcile("one");
				expect(recovered.value).toMatchObject({ decision: { id }, supersededDecisions: [{ boardAcknowledged: true }] });
				expect(recovered.value.blocker).toBeUndefined();
			}),
		);

		expect(publishedDecisions()).toEqual([old.decision.reason, changed.value.decision?.reason]);
		expect(acknowledgements()).toMatchObject([{ decision: old.published, disposition: "superseded" }]);
		expect(launches()).toEqual(["operation-1"]);
	},
);

isolatedEngine.it("reassigning an unknown decision is refused as a conflict", [], function* ({ fleet, prepareWork }) {
	yield* prepareWork("one");

	const outcome = yield* refusal(fleet.reassign("one", "missing", "maintainer"));

	expect(outcome).toEqual(CONFLICT);
});

isolatedEngine.it(
	"concurrent reassignments commit one new owner, refuse the other, and leave the old decision stale",
	[simultaneousDecisionWrites()],
	function* ({ armDecisionRace, askWorker, decisionWritesTogether, fleet, launches, prepareWork }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		const old = yield* askWorker();
		armDecisionRace();

		const raced = yield* decisionWritesTogether(
			fleet.reassign("one", old.decision.id, "maintainer"),
			fleet.reassign("one", old.decision.id, "maintainer"),
		);

		expect(raced).toEqual(["accepted", CONFLICT]);
		const current = (yield* fleet.reconcile("one")).value;
		expect(current).toMatchObject({ attentionOwner: "maintainer", supersededDecisions: [{ boardAcknowledged: true, published: old.published }] });
		expect(yield* refusal(fleet.reassign("one", old.decision.id, "orchestrator"))).toEqual(CONFLICT);
		expect(launches()).toEqual(["operation-1"]);
	},
);

isolatedEngine.it(
	"a reassignment racing a resolution commits only one of them and refuses the other as a conflict",
	[simultaneousDecisionWrites()],
	function* ({ armDecisionRace, askWorker, decisionWritesTogether, fleet, prepareWork, providerCalls, respond }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		const old = yield* askWorker();
		const answer = respond(old.decision.id, "retry");
		armDecisionRace();

		const raced = yield* decisionWritesTogether(fleet.reassign("one", old.decision.id, "maintainer"), fleet.resolve("one", old.decision.id, answer));

		expect(raced).toEqual(["accepted", CONFLICT]);
		const current = (yield* fleet.get("one")).value;
		expect([
			...(current.responses ?? []).map((response) => response.decisionId),
			...(current.supersededDecisions ?? []).map((decision) => decision.published.request),
		]).toEqual([old.decision.id]);
		expect(providerCalls().filter((call) => call.call === "turn")).toHaveLength(current.step === "working" ? 2 : 1);
	},
);
