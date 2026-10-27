import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { task } from "#test/fleetHost.ts";
import { BASE, HEAD, PR, REPORT } from "#test/githubResult.ts";
import { fakeCodex } from "#test/hostScenarioTraits.ts";
import { boardWork, host } from "#test/hostStory.ts";
import { humanDelivery } from "#test/humanDelivery.ts";

const review = `## TL;DR\n\nVerdict: approve. No findings worth raising.\n\n## Details\n\nNone.\n\nFLEET_REVIEW: ${JSON.stringify({ evidence: ["Independent review"], findings: [], head: HEAD, verdict: "approve" })}`;

for (const first of ["admission", "reconciliation", "preparation"]) {
	host.it(
		`released merge stays finished when ${first} observes it first`,
		[boardWork({ "one.md": task("one", "approved").replace("kind: task", "kind: task\nstatus: ready") }), humanDelivery, fakeCodex],
		function* (daemon) {
			const worker = yield* daemon.dispatch("one");
			daemon.completeCodexTurn(worker, REPORT);
			const reviewing = yield* daemon.reconcile("one");
			daemon.completeCodexTurn(reviewing, review);
			const ready = yield* daemon.reconcile("one");
			expect(ready.decision?.code).toBe("reviewed-pr-ready");
			expect((yield* daemon.cli(["release", "one"])).code).toBe(0);
			yield* daemon.appliedAnswer("one");
			yield* daemon.schedulerPass();
			expect((yield* daemon.get("one")).step).toBe("released");
			expect(
				daemon
					.codexRequests()
					.filter((request) => request.method === "turn/start")
					.map((request) => request.params),
			).toMatchObject([{ threadId: worker.attempts.at(-1)?.receipt?.sessionId }, { threadId: reviewing.attempts.at(-1)?.receipt?.sessionId }]);
			daemon.mergePullRequest();
			yield* daemon.stop();
			yield* daemon.start();
			if (first === "preparation") {
				const renewal = yield* daemon
					.request("fleet.prepare", {
						cwd: ready.cwd,
						preparation: ready.preparation,
						prompt: ready.prompt,
						workId: "one",
					})
					.pipe(Effect.result);
				expect(renewal).toMatchObject({ _tag: "Failure", failure: { _tag: "Forbidden" } });
			}
			if (first === "reconciliation") {
				yield* daemon.reconcile("one");
			}
			yield* daemon.schedulerPass();
			const finished = yield* daemon.get("one");
			expect(finished.outcome).toEqual({ head: HEAD, revision: BASE, url: PR });
			expect((yield* daemon.cli(["continue", "one", "Do this again."])).code).toBe(1);
			expect(finished.attempts.map((attempt) => attempt.receipt)).toEqual(ready.attempts.map((attempt) => attempt.receipt));
			daemon.writeBoard("one.md", task("one", "approved"));
			yield* daemon.approve("one");
			expect((yield* daemon.get("one")).attempts.map((attempt) => attempt.receipt)).toEqual(ready.attempts.map((attempt) => attempt.receipt));
			daemon.writeBoard("one.md", task("one", "approved", "Add the newly approved behavior."));
			yield* daemon.schedulerPass();
			expect((yield* daemon.get("one")).attempts.map((attempt) => attempt.receipt)).toEqual(ready.attempts.map((attempt) => attempt.receipt));
			const renewed = yield* daemon.approve("one");
			expect(renewed.value.step).toBe("working");
			expect(renewed.value.history?.at(-1)?.outcome).toEqual(finished.outcome);
			expect(
				daemon
					.codexRequests()
					.filter((request) => request.method === "turn/start")
					.map((request) => request.params),
			).toMatchObject([
				{ threadId: worker.attempts.at(-1)?.receipt?.sessionId },
				{ threadId: reviewing.attempts.at(-1)?.receipt?.sessionId },
				{ threadId: renewed.value.attempts.at(-1)?.receipt?.sessionId },
			]);
		},
	);
}
