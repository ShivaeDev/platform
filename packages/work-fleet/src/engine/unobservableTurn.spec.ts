import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { executing } from "#model.ts";
import { isolatedEngine } from "#test/engineStory.ts";
import { unobservableTurn } from "#test/unobservableTurn.ts";

const reconcile = Fleet.pipe(Effect.flatMap((fleet) => fleet.reconcile("one")));

isolatedEngine.it(
	"a stall recovery turn becomes visible after two observation passes across restart",
	[unobservableTurn()],
	function* ({ nativeRequests, showNativeTurn, advanceTime, fleet, afterRestart, publishedDecisions }) {
		expect((yield* fleet.get("one")).value.attempts.at(-1)?.receipt).toEqual({ sessionId: "worker-thread", turnId: "turn-2" });

		for (let pass = 0; pass < 2; pass += 1) {
			advanceTime(1 * 60_000);
			const pending = yield* afterRestart(reconcile);
			expect(pending.value.step).toBe("working");
			expect(pending.value.attempts.at(-1)?.missingSince).toBeDefined();
			expect(pending.value.decision).toBeUndefined();
		}
		showNativeTurn("turn-2");
		const visible = yield* fleet.reconcile("one");
		expect(visible.value.step).toBe("working");
		expect(visible.value.attempts.at(-1)?.missingSince).toBeUndefined();
		expect(visible.value.attempts.at(-1)?.status).toBe("running");
		expect(nativeRequests().filter((request) => request.method === "turn/start")).toHaveLength(2);
		expect(publishedDecisions()).toHaveLength(0);
	},
);

for (const progressingTurn of ["turn-1", "provider-followup"]) {
	isolatedEngine.it(
		`progress on ${progressingTurn} keeps an invisible acknowledged turn working past its grace period`,
		[unobservableTurn()],
		function* ({ nativeRequests, addProviderItem, setNativeTurnState, advanceTime, fleet, afterRestart, publishedDecisions }) {
			expect((yield* fleet.get("one")).value.attempts.at(-1)?.receipt).toEqual({ sessionId: "worker-thread", turnId: "turn-2" });

			yield* fleet.reconcile("one");
			setNativeTurnState(progressingTurn, "inProgress");
			for (let pass = 0; pass < 3; pass += 1) {
				advanceTime(6 * 60_000);
				addProviderItem();
				const current = yield* afterRestart(reconcile);
				expect(current.value.step).toBe("working");
				expect(current.value.attempts.at(-1)?.progress?.at).toBe((61 + (pass + 1) * 6) * 60_000);
				expect(current.value.decision).toBeUndefined();
			}
			expect(nativeRequests().filter((request) => request.method === "turn/start")).toHaveLength(2);
			expect(publishedDecisions()).toHaveLength(0);
		},
	);
}

isolatedEngine.it(
	"an invisible turn resumes once on the same thread and a second consecutive loss asks and can be released across restart",
	[unobservableTurn()],
	function* ({ nativeRequests, hideNativeTurn, advanceTime, fleet, afterRestart, respond, publishedDecisions }) {
		expect((yield* fleet.get("one")).value.attempts.at(-1)?.receipt).toEqual({ sessionId: "worker-thread", turnId: "turn-2" });

		yield* fleet.reconcile("one");
		advanceTime(4 * 60_000);
		expect((yield* fleet.reconcile("one")).value.attempts).toHaveLength(2);
		advanceTime(1 * 60_000);
		const resumed = yield* afterRestart(reconcile);
		expect(resumed.value.step).toBe("working");
		expect(resumed.value.decision).toBeUndefined();
		expect(resumed.value.attempts.at(-1)).toMatchObject({ observationRetries: 1, receipt: { sessionId: "worker-thread", turnId: "turn-3" } });
		expect(resumed.value.attempts[1]?.status).toBe("failed");
		hideNativeTurn("turn-3");
		yield* afterRestart(reconcile);
		advanceTime(5 * 60_000);
		const lost = yield* afterRestart(reconcile);
		expect(lost.value).toMatchObject({
			decision: { code: "session-turn-missing", reason: expect.stringContaining("one automatic resume") },
			step: "waiting",
		});
		expect(executing(lost.value)).toBe(true);
		expect(nativeRequests().filter((request) => request.method === "turn/start")).toHaveLength(3);
		expect(nativeRequests().filter((request) => request.method === "thread/start")).toHaveLength(1);
		expect(publishedDecisions()).toHaveLength(1);
		const decisionId = lost.value.decision?.id ?? "missing";
		const released = yield* afterRestart(
			Fleet.pipe(Effect.flatMap((restarted) => restarted.resolve("one", decisionId, respond(decisionId, "release")))),
		);
		expect(released.value.step).toBe("released");
		expect(released.value.attempts.at(-1)?.sessionUnusable).toBe(true);
	},
);

isolatedEngine.it(
	"observing the resumed turn resets consecutive visibility losses",
	[unobservableTurn()],
	function* ({ hideNativeTurn, advanceTime, fleet, afterRestart, publishedDecisions }) {
		expect((yield* fleet.get("one")).value.attempts.at(-1)?.receipt).toEqual({ sessionId: "worker-thread", turnId: "turn-2" });

		yield* fleet.reconcile("one");
		advanceTime(5 * 60_000);
		yield* fleet.reconcile("one");
		const visible = yield* afterRestart(reconcile);
		expect(visible.value.attempts.at(-1)?.observationRetries).toBeUndefined();
		hideNativeTurn("turn-3");
		yield* fleet.reconcile("one");
		advanceTime(5 * 60_000);
		const resumed = yield* afterRestart(reconcile);
		expect(resumed.value.step).toBe("working");
		expect(resumed.value.attempts.at(-1)?.receipt?.turnId).toBe("turn-4");
		expect(publishedDecisions()).toHaveLength(0);
	},
);
