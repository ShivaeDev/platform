import { expect } from "@effect/vitest";
import { pendingSessionCleanup } from "#engine/sessionCleanup.ts";
import { engine } from "#test/engineStory.ts";
import { humanMergeRequired, noChangeReported } from "#test/engineTraits.ts";

engine.it(
	"retains the continued worker thread when its new result still needs a human",
	[humanMergeRequired()],
	function* ({ archivedSessions, finishWorkers, prepareWork, fleet }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		finishWorkers();
		const stopped = yield* fleet.reconcile("one");
		const sessionId = stopped.value.attempts[0]?.receipt?.sessionId;
		expect(sessionId).toBeDefined();
		expect(stopped.value.step).toBe("waiting");
		yield* fleet.continue("one", "Repair the outstanding criterion");
		finishWorkers();
		const continued = yield* fleet.reconcile("one");
		expect(continued.value.step).toBe("waiting");
		expect(continued.value).toMatchObject({ attentionOwner: "orchestrator", decision: { attentionOwner: "orchestrator" } });
		expect(continued.value.attempts[0]?.receipt?.sessionId).toBe(sessionId);
		expect(archivedSessions()).not.toContain(sessionId);
		expect(pendingSessionCleanup(continued.value)).not.toContain(sessionId);
	},
);

engine.it(
	"continues done work on the same session and cleans up that session after the new completion",
	[noChangeReported()],
	function* ({ archivedSessions, launches, finishWorkers, prepareWork, fleet }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		finishWorkers();
		const completed = yield* fleet.reconcile("one");
		const sessionId = completed.value.attempts[0]?.receipt?.sessionId;
		expect(sessionId).toBeDefined();
		expect(completed.value.step).toBe("done");
		expect(archivedSessions().filter((id) => id === sessionId)).toHaveLength(1);
		const continued = yield* fleet.continue("one", "Check one more case");
		expect(continued.value.attempts[0]?.receipt?.sessionId).toBe(sessionId);
		expect(continued.value.attempts[0]?.sessionCleanupComplete).toBeUndefined();
		yield* fleet.reconcile("one");
		expect(archivedSessions().filter((id) => id === sessionId)).toHaveLength(1);
		finishWorkers();
		expect((yield* fleet.reconcile("one")).value.step).toBe("done");
		expect(archivedSessions().filter((id) => id === sessionId)).toHaveLength(2);
		expect(launches().filter((id) => id === "operation-1")).toHaveLength(1);
	},
);
