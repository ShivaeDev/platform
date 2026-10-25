import { expect } from "@effect/vitest";
import { cycle } from "#engine/scheduler.ts";
import { initialQueueFull } from "#test/engineProviderRetryTraits.ts";
import { engine } from "#test/engineStory.ts";
import { markdownWork } from "#test/engineTraits.ts";

for (const rejectedCall of ["session", "turn"] as const) {
	engine.it(
		`a queued initial ${rejectedCall} retries the approved edited brief`,
		[markdownWork(), initialQueueFull(rejectedCall)],
		function* ({
			setFleetTime,
			changeHostModel,
			recoverProvider,
			fleet,
			prepareWork,
			afterRestart,
			launches,
			providerCalls,
			source,
			writeBoardWork,
		}) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			const queued = (yield* fleet.get("one")).value;
			const failed = queued.attempts.at(-1);
			const current = `${source}\nNew approved criteria.\n`;
			writeBoardWork("one.md", current);
			changeHostModel("new-host-model");
			recoverProvider();
			setFleetTime(30_099);
			yield* afterRestart(cycle);
			expect(launches()).toEqual(["operation-1"]);
			setFleetTime(30_100);
			yield* afterRestart(cycle);
			const accepted = (yield* fleet.get("one")).value;
			const attempt = accepted.attempts.at(-1);
			expect(accepted.step).toBe("working");
			expect(accepted.decision).toBeUndefined();
			expect(accepted.boardContext).toBe(current);
			expect(accepted.launchRetry).toBeUndefined();
			expect(attempt).toMatchObject({ prompt: expect.stringContaining(current), settings: failed?.settings, status: "accepted" });
			expect(accepted.attempts.slice(0, -1)).toEqual(queued.attempts);
			expect(launches()).toHaveLength(rejectedCall === "session" ? 2 : 1);
			expect(providerCalls().filter((call) => call.call === "turn")).toHaveLength(rejectedCall === "turn" ? 2 : 1);
		},
	);
}
