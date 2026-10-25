import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { boardAcknowledgementFailsOnce } from "#test/engineLifecycleTraits.ts";
import { simultaneousDecisionWrites } from "#test/engineRaceTraits.ts";
import { isolatedEngine } from "#test/engineStory.ts";

isolatedEngine.it(
	"reassignment recovers a failed supersession acknowledgement without publishing another question",
	[boardAcknowledgementFailsOnce()],
	function* ({ fleet, prepareWork, afterRestart, launches, publishedDecisions, acknowledgements, askWorker }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		const old = yield* askWorker();
		const changed = yield* fleet.reassign("one", old.decision.id, "maintainer");
		expect(changed.value.blocker).toContain("Board request acknowledgement pending");
		expect(changed.value.attentionOwner).toBe("maintainer");
		expect(changed.value.supersededDecisions?.[0]?.boardAcknowledged).toBeUndefined();
		const id = changed.value.decision?.id ?? "missing";
		yield* afterRestart(
			Effect.gen(function* () {
				const restarted = yield* Fleet;
				const retried = yield* restarted.reassign("one", old.decision.id, "maintainer");
				expect(retried.value.decision?.id).toBe(id);
				const recovered = yield* restarted.reconcile("one");
				expect(recovered.value.decision?.id).toBe(id);
				expect(recovered.value.supersededDecisions?.[0]?.boardAcknowledged).toBe(true);
				expect(recovered.value.blocker).toBeUndefined();
			}),
		);
		expect(publishedDecisions()).toHaveLength(2);
		expect(acknowledgements()).toMatchObject([{ decision: old.published, disposition: "superseded" }]);
		expect(launches()).toHaveLength(1);
	},
);

isolatedEngine.it(
	"concurrent reassignment commits one new decision and rejects stale decision IDs",
	[simultaneousDecisionWrites()],
	function* ({ armDecisionRace, fleet, prepareWork, launches, askWorker }) {
		yield* prepareWork("one");
		expect(yield* fleet.reassign("one", "missing", "maintainer").pipe(Effect.flip)).toMatchObject({ _tag: "Conflict" });
		yield* fleet.dispatch("one");
		const old = yield* askWorker();
		armDecisionRace();
		const results = yield* Effect.all(
			[
				fleet.reassign("one", old.decision.id, "maintainer").pipe(Effect.result),
				fleet.reassign("one", old.decision.id, "maintainer").pipe(Effect.result),
			],
			{ concurrency: "unbounded" },
		);
		expect(results.filter((result) => result._tag === "Success")).toHaveLength(1);
		for (const result of results) {
			if (result._tag === "Failure") {
				expect(result.failure).toMatchObject({ _tag: "Conflict" });
			}
		}
		const current = (yield* fleet.reconcile("one")).value;
		expect(current.attentionOwner).toBe("maintainer");
		expect(current.supersededDecisions).toHaveLength(1);
		expect(yield* fleet.reassign("one", old.decision.id, "orchestrator").pipe(Effect.flip)).toMatchObject({ _tag: "Conflict" });
		expect(launches()).toHaveLength(1);
	},
);

isolatedEngine.it(
	"reassignment racing resolution commits one action and the loser reports a typed stale decision",
	[simultaneousDecisionWrites()],
	function* ({ armDecisionRace, fleet, prepareWork, respond, providerCalls, askWorker }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		const old = yield* askWorker();
		const answer = respond(old.decision.id, "retry");
		armDecisionRace();
		const results = yield* Effect.all(
			[fleet.reassign("one", old.decision.id, "maintainer").pipe(Effect.result), fleet.resolve("one", old.decision.id, answer).pipe(Effect.result)],
			{ concurrency: "unbounded" },
		);
		expect(results.filter((result) => result._tag === "Success")).toHaveLength(1);
		for (const result of results) {
			if (result._tag === "Failure") {
				expect(result.failure).toMatchObject({ _tag: "Conflict" });
			}
		}
		const current = (yield* fleet.get("one")).value;
		expect((current.responses?.length ?? 0) + (current.supersededDecisions?.length ?? 0)).toBe(1);
		expect(providerCalls().filter((call) => call.call === "turn")).toHaveLength(current.step === "working" ? 2 : 1);
	},
);
