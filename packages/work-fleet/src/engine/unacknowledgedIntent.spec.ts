import { Effect, Fiber } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
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
			const stopped = yield* afterRestart((resumed) => resumed.reconcile("one"));
			expect(stopped.value.decision?.reason).toContain("Lost thread acknowledgement");
			const decisionId = stopped.value.decision?.id ?? "missing";
			const responseId = respond(decisionId, action);

			const resolved = yield* afterRestart((resumed) => resumed.resolve("one", decisionId, responseId));
			expect(resolved.value.step).toBe(action === "retry" ? "queued" : "released");
			expect(resolved.value.attempts[0]).toMatchObject({ status: "failed" });
			yield* releaseGate("session");
			yield* Effect.yieldNow;
			const beforeAcknowledgement = yield* fleet.get("one");
			const lateAcknowledgementOutcome = yield* refusal(acknowledgeProviderTurn("operation-1", { sessionId: "session-operation-1", turnId: "late" }));
			yield* outcomes([
				[
					"late acknowledgement",
					() => Effect.succeed(lateAcknowledgementOutcome),
					"session persistence: Independent review or submission acknowledgement conflicts with the persisted exact receipt",
				],
				["execution record", () => fleet.get("one"), beforeAcknowledgement],
				["session", () => fleet.get("one").pipe(Effect.map((current) => current.value.attempts[0]?.sessionId)), undefined],
				["provider operations", () => Effect.sync(providerOperations), []],
			]);
			const afterRestartResult = yield* afterRestart((resumed) => resumed.resolve("one", decisionId, responseId));
			expect(afterRestartResult.value.responses).toEqual(resolved.value.responses);
			if (action === "retry") {
				const fresh = yield* afterRestart((resumed) => resumed.dispatch("one"));
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
		const stopped = yield* afterRestart((resumed) => resumed.reconcile("one"));
		const decisionId = stopped.value.decision?.id ?? "missing";
		const responseId = respond(decisionId, "release");

		const retiring = yield* afterRestart((resumed) => refusal(resumed.resolve("one", decisionId, responseId))).pipe(Effect.forkChild);
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
		expect((yield* afterRestart((resumed) => resumed.resolve("one", decisionId, responseId))).value.step).toBe("released");
		expect(providerOperations()).toEqual(["operation-1"]);
	},
	{ clock: "live", timeout: 30_000 },
);
