import { Effect, Fiber } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { Fleet } from "#fleet.ts";
import { isolatedEngine } from "#test/engineStory.ts";
import { refusal } from "#test/refusal.ts";
import { unacknowledgedSession } from "#test/unacknowledgedSession.ts";

for (const action of ["retry", "release"] as const) {
	isolatedEngine.it(
		`lost thread acknowledgement ${action} fences a late session before any turn starts`,
		[unacknowledgedSession()],
		function* ({ releaseGate, fleet, prepareWork, afterRestart, respond, providerOperations, acknowledgeProviderTurn }) {
			yield* prepareWork("one");

			yield* fleet.dispatch("one");
			const stopped = yield* afterRestart(Fleet.pipe(Effect.flatMap((resumed) => resumed.reconcile("one"))));
			expect(stopped.value.decision?.reason).toContain("Lost thread acknowledgement");
			const decisionId = stopped.value.decision?.id ?? "missing";
			const responseId = respond(decisionId, action);
			const resolve = Fleet.pipe(Effect.flatMap((resumed) => resumed.resolve("one", decisionId, responseId)));
			const resolved = yield* afterRestart(resolve);
			expect(resolved.value.step).toBe(action === "retry" ? "queued" : "released");
			expect(resolved.value.attempts[0]).toMatchObject({ status: "failed" });
			yield* releaseGate("session");
			yield* Effect.yieldNow;
			const lateAcknowledgementOutcome = yield* refusal(acknowledgeProviderTurn("operation-1", { sessionId: "session-operation-1", turnId: "late" }));
			expect(lateAcknowledgementOutcome).not.toBe("accepted");
			expect((yield* fleet.get("one")).value.attempts[0]?.sessionId).toBeUndefined();
			expect(providerOperations()).toEqual([]);
			const afterRestartResult = yield* afterRestart(resolve);
			expect(afterRestartResult.value.responses).toEqual(resolved.value.responses);
			if (action === "retry") {
				const fresh = yield* afterRestart(Fleet.pipe(Effect.flatMap((resumed) => resumed.dispatch("one"))));
				expect(fresh.value.attempts.at(-1)?.receipt?.turnId).toBe("turn-operation-2");
			}
		},
		{ clock: "live", timeout: 30_000 },
	);
}

isolatedEngine.it(
	"acknowledgement winning the retirement race retains execution until terminal observation",
	[unacknowledgedSession(true)],
	function* ({
		releaseGate,
		waitForGate,
		awaitRecordedReceipt,
		fleet,
		prepareWork,
		finishWorkers,
		afterRestart,
		respond,
		providerOperations,
		stepOf,
	}) {
		yield* prepareWork("one");

		yield* fleet.dispatch("one");
		const stopped = yield* afterRestart(Fleet.pipe(Effect.flatMap((resumed) => resumed.reconcile("one"))));
		const decisionId = stopped.value.decision?.id ?? "missing";
		const responseId = respond(decisionId, "release");
		const resolve = Fleet.pipe(Effect.flatMap((resumed) => resumed.resolve("one", decisionId, responseId)));
		const retiring = yield* afterRestart(refusal(resolve)).pipe(Effect.forkChild);
		yield* waitForGate("retiring");
		yield* releaseGate("session");
		yield* waitForGate("turn");
		yield* releaseGate("commit");
		const rejected = yield* Fiber.join(retiring);
		expect(rejected).toMatch(/^conflict: /u);
		yield* outcomes([
			["one session", () => fleet.get("one").pipe(Effect.map((current) => current.value.attempts[0]?.sessionId)), "session-operation-1"],
			["one", () => stepOf("one"), "waiting"],
		]);
		yield* awaitRecordedReceipt("one");
		finishWorkers();
		expect((yield* afterRestart(resolve)).value.step).toBe("released");
		expect(providerOperations()).toEqual(["operation-1"]);
	},
	{ clock: "live", timeout: 30_000 },
);
