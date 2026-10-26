import { expect } from "vitest";
import { statusMarkdown } from "#board/statusMarkdown.ts";
import { isolatedEngine } from "#test/engineStory.ts";
import { nativeStalledTurn } from "#test/nativeStalledTurn.ts";

isolatedEngine.it(
	"a silent turn asks the orchestrator after the stall interval without messaging the worker",
	[nativeStalledTurn()],
	function* ({ nativeRequests, advanceTime, fleet, prepareWork, afterRestart, publishedDecisions }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		yield* fleet.reconcile("one");
		advanceTime(29 * 60_000);
		const quiet = yield* fleet.reconcile("one");
		expect(quiet.value.step).toBe("working");
		advanceTime(2 * 60_000);
		const stalled = yield* fleet.reconcile("one");
		expect(stalled.value).toMatchObject({
			attentionOwner: "orchestrator",
			decision: { code: "session-stalled", reason: "Provider turn showed no activity for 30 minutes" },
			decisionPublished: true,
			step: "waiting",
		});
		expect(stalled.value.attempts.map((attempt) => attempt.status)).toEqual(["running"]);
		expect(publishedDecisions()).toEqual([stalled.value.decision?.reason]);
		advanceTime(60 * 60_000);
		yield* afterRestart(fleet.reconcile("one"));
		expect(
			nativeRequests()
				.filter((request) => ["turn/steer", "turn/interrupt", "turn/start"].includes(request.method))
				.map((request) => request.method),
		).toEqual(["turn/start"]);
		expect(statusMarkdown([stalled.value])).not.toContain("steer");
	},
);
