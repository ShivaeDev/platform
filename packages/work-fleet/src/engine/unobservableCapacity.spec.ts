import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { cycle } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import { replacementTurnCanDisappear } from "#test/engineStalledTurnTraits.ts";
import { engine } from "#test/engineStory.ts";

const reconcile = Fleet.pipe(Effect.flatMap((fleet) => fleet.reconcile("one")));

for (const role of ["worker", "reviewer"] as const) {
	engine.it(
		`an invisible ${role} replacement retains its loss count through capacity rejection and restart`,
		[replacementTurnCanDisappear()],
		function* ({
			hideProviderTurns,
			rejectProvider,
			recoverProvider,
			advanceTime,
			currentTime,
			fleet,
			prepareWork,
			finishWorkers,
			afterRestart,
			publishedDecisions,
			providerCalls,
		}) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			if (role === "reviewer") {
				finishWorkers();
				yield* fleet.reconcile("one");
			}
			const initial = (yield* fleet.get("one")).value;
			expect(initial.attempts.at(-1)?.role).toBe(role);
			hideProviderTurns();
			yield* fleet.reconcile("one");
			rejectProvider();
			advanceTime(5 * 60_000);
			const queued = yield* afterRestart(reconcile);
			expect(queued.value.launchRetry).toEqual({ rejectedAt: currentTime(), rejections: 1, retryAt: currentTime() + 30_000 });
			expect(queued.value.attempts.at(-1)).toMatchObject({ observationRetries: 1, role, status: "failed" });
			expect(publishedDecisions()).toHaveLength(0);
			recoverProvider();
			advanceTime(30_000);
			yield* afterRestart(cycle);
			const replacement = yield* afterRestart(reconcile);
			expect(replacement.value.launchRetry).toBeUndefined();
			expect(replacement.value.attempts.at(-1)?.receipt).toBeDefined();
			expect(replacement.value.decision).toBeUndefined();
			advanceTime(5 * 60_000);
			const lost = yield* afterRestart(reconcile);
			expect(lost.value).toMatchObject({
				decision: { code: "session-turn-missing", reason: expect.stringContaining("one automatic resume") },
				step: "waiting",
			});
			expect(lost.value.attempts).toHaveLength(initial.attempts.length + 2);
			expect(providerCalls().filter((setting) => setting.call === "turn")).toHaveLength(initial.attempts.length + 2);
			expect(publishedDecisions()).toEqual([lost.value.decision?.reason]);
		},
	);
}
