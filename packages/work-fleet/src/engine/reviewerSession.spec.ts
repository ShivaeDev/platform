import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { engine } from "#test/engineStory.ts";
import { configured, reviewAcknowledgementLost, reviewEnds, reviewerStillRunning } from "#test/engineTraits.ts";
import { pullRequestHeadCanMove } from "#test/pullRequestHeadCanMove.ts";

describe("independent reviewer sessions", () => {
	engine.it(
		"launches asynchronously with host settings and accepts only a completed verdict",
		[
			reviewerStillRunning(),
			configured({
				launch: { effort: "high", model: "host-model", serviceTier: "priority" },
				reviewerGuidance: "Inspect synthetic database checks.",
			}),
		],
		function* ({ fixture, fleet, prepareWork, finishWorkers, restart }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			const reviewing = yield* fleet.reconcile("one");
			const attempt = reviewing.value.attempts.at(-1);
			expect(reviewing.value.stage).toBe("reviewing");
			expect(reviewing.value.review).toBeUndefined();
			expect(attempt).toMatchObject({ reviewHead: "head-one-0", role: "reviewer", status: "running" });
			const start = fixture.starts.at(-1);
			expect(start).toMatchObject({ access: "read-only", settings: { effort: "high", model: "host-model", serviceTier: "priority" } });
			expect(start?.prompt).toContain(fixture.work("one").context);
			expect(start?.prompt).toContain("https://example.invalid/pr/one");
			expect(start?.prompt).toContain("Inspect synthetic database checks.");
			expect(start?.prompt).not.toContain("Implement one");
			finishWorkers();
			const completed = yield* restart(fleet.reconcile("one"));
			expect(completed.value.stage).toBe("completed");
			expect(completed.value.review).toMatchObject({ head: "head-one-0", receipt: attempt?.receipt, verdict: "approved" });
			expect(fixture.launched).toHaveLength(2);
		},
	);
	engine.it(
		"recovers a lost reviewer turn response by its durable session without another launch",
		[reviewAcknowledgementLost()],
		function* ({ fixture, fleet, prepareWork, finishWorkers, restart, respond }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			const lost = yield* fleet.reconcile("one");
			expect(lost.value.attempts.at(-1)).toMatchObject({ role: "reviewer", sessionId: "session-operation-2", status: "submitting" });
			expect(lost.value.attempts.at(-1)?.receipt).toBeUndefined();
			yield* fleet.resolve("one", lost.value.decision?.id ?? "missing", respond(lost.value.decision?.id ?? "missing", "retry"));
			expect((yield* restart(fleet.reconcile("one"))).value.stage).toBe("completed");
			expect(fixture.launched).toHaveLength(2);
		},
	);
	for (const reviewExecution of ["failed", "interrupted"] as const) {
		engine.it(
			`retains terminal reviewer ${reviewExecution} evidence without accepting a verdict`,
			[reviewEnds(reviewExecution)],
			function* ({ fleet, prepareWork, finishWorkers }) {
				yield* prepareWork("one");
				yield* fleet.dispatch("one");
				finishWorkers();
				const failed = yield* fleet.reconcile("one");
				expect(failed.value.stage).toBe("needs-human");
				expect(failed.value.attentionOwner).toBe("orchestrator");
				expect(failed.value.attempts.at(-1)?.status).toBe(reviewExecution);
				expect(failed.value.review).toBeUndefined();
				expect(failed.value.outcome).toBeUndefined();
			},
		);
	}
	engine.it(
		"a human retry after confirmed reviewer failure starts a fresh independent session",
		[reviewerStillRunning()],
		function* ({ fixture, fleet, prepareWork, finishWorkers, respond }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			const reviewing = yield* fleet.reconcile("one");
			const original = reviewing.value.attempts.at(-1)?.receipt;
			if (original === undefined) {
				return yield* Effect.die(new Error("Reviewer receipt missing"));
			}
			fixture.observations.set(original.turnId, { execution: "failed", output: "Provider failure", provisioning: "ready", receipt: original });
			const failed = yield* fleet.reconcile("one");
			const id = failed.value.decision?.id ?? "missing";
			yield* fleet.resolve("one", id, respond(id, "retry"));
			const retry = yield* fleet.reconcile("one");
			expect(retry.value.stage).toBe("reviewing");
			expect(retry.value.attempts.at(-1)?.receipt?.sessionId).not.toBe(original.sessionId);
			expect(retry.value.attempts.at(-1)?.status).toBe("running");
			finishWorkers();
			expect((yield* fleet.reconcile("one")).value.stage).toBe("completed");
			expect(fixture.launched).toHaveLength(3);
		},
	);
	{
		const setup = pullRequestHeadCanMove();
		engine.it(
			"keeps approval on the old head and starts fresh review when the PR head moves",
			[setup.given],
			function* ({ fixture, fleet, prepareWork, finishWorkers }) {
				const context = setup.context();
				yield* prepareWork("one");
				yield* fleet.dispatch("one");
				finishWorkers();
				yield* fleet.reconcile("one");
				context.result = { ...context.result, head: "second-head" };
				finishWorkers();
				const moved = yield* fleet.reconcile("one");
				expect(moved.value.stage).toBe("reviewing");
				expect(moved.value.result?.head).toBe("second-head");
				expect(moved.value.review?.head).toBe("first-head");
				expect(moved.value.checks).toBeUndefined();
				expect(fixture.merged).toHaveLength(0);
				const fresh = yield* fleet.reconcile("one");
				expect(fresh.value.attempts.at(-1)).toMatchObject({ reviewHead: "second-head", status: "running" });
				finishWorkers();
				expect((yield* fleet.reconcile("one")).value.stage).toBe("completed");
				expect(fixture.reviews).toEqual(["first-head", "second-head"]);
				expect(fixture.merged).toEqual(["second-head"]);
			},
		);
	}
});
