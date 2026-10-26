import { expect } from "vitest";
import { isolatedEngine } from "#test/engineStory.ts";
import { markdownWork } from "#test/engineTraits.ts";
import { nativeStalledTurn } from "#test/nativeStalledTurn.ts";

isolatedEngine.it(
	"a restart counts silence from subscribing, even when stored progress is old",
	[nativeStalledTurn()],
	function* ({ advanceTime, fleet, prepareWork, restart, currentTime }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		const before = yield* fleet.reconcile("one");
		advanceTime(60 * 60_000);
		yield* restart();
		advanceTime(10 * 60_000);
		const subscribed = yield* fleet.reconcile("one");
		expect(before.value.attempts[0]?.progress?.at).toBe(0);
		expect(subscribed.value.step).toBe("working");
		expect(subscribed.value.decision).toBeUndefined();
		expect(subscribed.value.attempts[0]?.progress?.at).toBe(currentTime());
		advanceTime(29 * 60_000);
		expect((yield* fleet.reconcile("one")).value.step).toBe("working");
		advanceTime(60_000);
		expect((yield* fleet.reconcile("one")).value.decision?.code).toBe("session-stalled");
	},
);

isolatedEngine.it(
	"keeping a stalled worker waits another full interval on the same turn",
	[nativeStalledTurn(), markdownWork()],
	function* ({ advanceTime, fleet, prepareWork, answerPublishedDecision, nativeRequests, readBoardPublication }) {
		yield* prepareWork("one");
		yield* fleet.dispatch("one");
		yield* fleet.reconcile("one");
		advanceTime(30 * 60_000);
		const stalled = yield* fleet.reconcile("one");
		expect(stalled.value.decision?.code).toBe("session-stalled");
		const card = readBoardPublication(stalled.value.decision?.published?.sourcePath ?? "missing");
		expect(card.body).toContain(':::option{id="wait"}');
		expect(card.body).toContain("Keep waiting");
		advanceTime(10 * 60_000);
		const resumed = yield* answerPublishedDecision("one", "wait");
		expect(resumed.value.step).toBe("working");
		expect(resumed.value.decision).toBeUndefined();
		expect(resumed.value.attempts[0]?.receipt).toEqual(stalled.value.attempts[0]?.receipt);
		expect(resumed.value.attempts[0]?.sessionUnusable).toBeUndefined();
		expect(resumed.value.responses).toMatchObject([{ action: "wait", boardAcknowledged: true }]);
		advanceTime(29 * 60_000);
		expect((yield* fleet.reconcile("one")).value.step).toBe("working");
		advanceTime(60_000);
		expect((yield* fleet.reconcile("one")).value.decision?.code).toBe("session-stalled");
		expect(
			nativeRequests()
				.filter(({ method }) => ["turn/start", "turn/interrupt"].includes(method))
				.map(({ method }) => method),
		).toEqual(["turn/start"]);
	},
);
