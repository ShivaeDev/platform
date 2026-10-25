import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { executing } from "#model.ts";
import { workerTurnsCanBeLost } from "#test/engineLostTurnTraits.ts";
import { engine } from "#test/engineStory.ts";
import { githubPullRequest } from "#test/engineTraits.ts";
import { HEAD, MOVED, REPORT } from "#test/githubResult.ts";

for (const scenario of ["execution decision", "legacy delivery decision", "persisted delivery step"]) {
	const legacy = scenario !== "execution decision";
	engine.it(
		`retry from ${scenario} settles a merged PR after a lost repair acknowledgement`,
		[githubPullRequest(), workerTurnsCanBeLost()],
		function* (fleet) {
			for (const id of ["one", "two"]) {
				fleet.setAreas(id, ["shared"]);
				yield* fleet.prepareWork(id);
			}
			const worker = yield* fleet.dispatch("one");
			fleet.workerReports(REPORT);
			const ready = yield* fleet.reconcile("one");
			expect(ready.value.decision?.code).toBe("reviewed-pr-ready");
			expect(ready.value.review?.head).toBe(HEAD);
			fleet.loseNextAcknowledgement();
			fleet.reviseBrief("one", "edited-brief");
			const repair = yield* fleet.reconcile("one");
			const sessionId = repair.value.attempts.at(-1)?.sessionId ?? (yield* Effect.die("Missing repair session"));
			expect(repair.value.attempts.at(-1)).toMatchObject({ role: "repair", sessionId, status: "submitting" });
			expect(repair.value.attempts.at(-1)?.receipt).toBeUndefined();
			expect(sessionId).toBe(worker.value.attempts[0]?.sessionId);
			fleet.loseTurn(sessionId);
			fleet.threadActive(sessionId);
			yield* fleet.reconcile("one");
			fleet.advanceTime(300_000);
			const missing = yield* fleet.reconcile("one");
			expect(missing.value.decision?.code).toBe("session-turn-missing");
			fleet.movePullRequestHead(MOVED);
			const moved = yield* fleet.reconcile("one");
			if (legacy) {
				// Reproduce the persisted decision replacement made by older daemons.
				yield* fleet.replaceStoredRecord({
					...moved.value,
					decision: moved.value.decision === undefined ? undefined : { ...moved.value.decision, code: "pr-head-moved" },
				});
			} else {
				expect(moved.value.decision).toEqual(missing.value.decision);
			}
			fleet.mergePullRequest();
			fleet.restoreTurn(sessionId);
			fleet.workerReports(REPORT);
			yield* fleet.restart();
			const answered = yield* fleet.answerDecision("one", "retry");
			if (legacy) {
				expect(answered.value.step).toBe("working");
			}
			if (scenario === "persisted delivery step") {
				// Older daemons saved this step after applying the retry answer.
				yield* fleet.replaceStoredRecord({ ...answered.value, step: "delivering" });
				yield* fleet.restart();
			}
			const settled = yield* fleet.reconcile("one");
			expect(settled.value.step).toBe("released");
			expect(settled.value.mergedDelivery).toMatchObject({ head: MOVED });
			expect(settled.value.releaseReason).toContain(`Fleet review covered ${HEAD}`);
			expect(settled.value.outcome).toBeUndefined();
			expect(executing(settled.value)).toBe(false);
			expect((yield* fleet.dispatch("two")).value.step).toBe("working");
		},
	);
}
