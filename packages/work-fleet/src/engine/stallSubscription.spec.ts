import { expect } from "vitest";
import { isolatedEngine } from "#test/engineStory.ts";
import { markdownWork } from "#test/engineTraits.ts";
import { nativeStalledTurn } from "#test/nativeStalledTurn.ts";

isolatedEngine.it(
	"a restart gives old stored progress a full silence interval after subscribing",
	[nativeStalledTurn()],
	function* ({ prepareWork, fleet, advanceTime, restart, nativeRequests }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		yield* fleet.reconcile("one");
		advanceTime(60 * 60_000);
		yield* restart();
		const subscribed = yield* fleet.reconcile("one");
		expect(subscribed.value.step).toBe("working");
		expect(subscribed.value.decision).toBeUndefined();
		expect(
			nativeRequests()
				.filter((request) => request.method === "thread/resume")
				.map((request) => request.params),
		).toEqual([{ excludeTurns: true, threadId: "worker-thread" }]);
		advanceTime(29 * 60_000);
		expect((yield* fleet.reconcile("one")).value.step).toBe("working");
		advanceTime(60_000);
		expect((yield* fleet.reconcile("one")).value.decision?.code).toBe("session-stalled");
	},
);

isolatedEngine.it(
	"keep waiting preserves the worker and restarts its silence interval",
	[markdownWork(), nativeStalledTurn()],
	function* ({ prepareWork, fleet, advanceTime, answerPublishedDecision, nativeRequests, publishedDocuments, readBoardWork }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		yield* fleet.reconcile("one");
		advanceTime(31 * 60_000);
		const stalled = yield* fleet.reconcile("one");
		const decision = stalled.value.decision;
		expect(decision?.code).toBe("session-stalled");
		const card = readBoardWork(decision?.published?.sourcePath ?? "missing");
		expect(card).toContain(':::option{id="wait"}\n### Keep waiting');
		expect(card).toContain(':::option{id="retry"}');
		expect(card).toContain(':::option{id="release"}');
		const waiting = yield* answerPublishedDecision("one", "wait");
		expect(waiting.value).toMatchObject({ attempts: [{ receipt: stalled.value.attempts[0]?.receipt, status: "running" }], step: "working" });
		expect(waiting.value.decision).toBeUndefined();
		expect(publishedDocuments().find((entry) => entry.file === decision?.published?.sourcePath)?.parsed.fields.attention).toMatchObject([
			{ state: "closed" },
		]);
		advanceTime(29 * 60_000);
		expect((yield* fleet.reconcile("one")).value.step).toBe("working");
		advanceTime(60_000);
		expect((yield* fleet.reconcile("one")).value.decision?.code).toBe("session-stalled");
		expect(
			nativeRequests()
				.filter((request) => ["turn/start", "turn/interrupt", "turn/steer"].includes(request.method))
				.map((request) => request.method),
		).toEqual(["turn/start"]);
	},
);
