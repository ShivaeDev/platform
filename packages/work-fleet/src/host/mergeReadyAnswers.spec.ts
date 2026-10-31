import { expect } from "@effect/vitest";
import { Effect, Option, Stream } from "effect";
import { answers, approvedPullRequest } from "#test/answerHost.ts";
import { refusal } from "#test/refusal.ts";

answers.it("a merge-ready decision never attempts an answer removed since its scan", [approvedPullRequest], function* (host) {
	const ready = yield* host.readyPullRequest();
	const response = host.publishPullRequestResponse(ready, "Change the message.", "orchestrator");
	const before = host.resolutionReads();
	const waiting = yield* host.inBoardScan(
		Effect.gen(function* () {
			yield* host.scanBoard();
			host.removePullRequestResponse(response.responseId);
			return (yield* host.reconcileScanned()).value;
		}),
	);
	expect(waiting.decision?.id).toBe(ready.decision?.id);
	expect(waiting.blocker).toBeUndefined();
	expect(waiting.responses ?? []).toEqual([]);
	expect(host.resolutionReads()).toBe(before);
	expect(yield* host.storedRequests()).toEqual([]);
});

answers.it("a superseded merge-ready answer points to the current answer, which applies", [approvedPullRequest], function* (host) {
	const ready = yield* host.readyPullRequest();
	const old = host.publishPullRequestResponse(ready, "Old feedback.");
	const current = host.publishPullRequestResponse(ready, "Please adjust the error message.");

	const superseded = yield* refusal(host.resolve(old.decisionId, old.responseId));
	const applied = yield* host.resolve(current.decisionId, current.responseId);

	expect(superseded).toBe(`conflict: Board response ${old.responseId} is superseded by ${current.responseId}; apply the current response instead`);
	expect({ blocker: applied.blocker, response: applied.responses?.at(-1) }).toMatchObject({
		blocker: undefined,
		response: { action: "retry", boardAcknowledged: true },
	});
});

answers.it("a missing merge-ready answer tells the answerer to record a current answer", [approvedPullRequest], function* (host) {
	const ready = yield* host.readyPullRequest();

	const missing = yield* refusal(host.resolve(ready.decision?.id ?? "missing", "response.absent"));

	expect({ missing, responses: (yield* host.get()).responses ?? [] }).toEqual({
		missing: "conflict: Board response response.absent is missing; record an answer to the current Fleet decision before applying it",
		responses: [],
	});
});

answers.it("an earlier failed answer becomes quiet as soon as its reviewed PR merges", [approvedPullRequest], function* (host) {
	const ready = yield* host.readyPullRequest();
	const decision = ready.decision;
	if (decision === undefined) {
		return yield* Effect.die("Missing merge decision");
	}
	const request = yield* host.seedRecordedRequest(decision, "Change the message.", false);
	yield* host.failRecordedRequest(request, "Board response is missing, ambiguous, superseded or belongs to changed context");
	expect((yield* host.status()).waiting.orchestrator).toMatchObject([{ blocker: expect.stringContaining("Answer failed:") }]);
	host.mergePullRequest();
	expect((yield* host.reconcile()).step).toBe("done");
	const status = yield* host.status();
	expect(status.waiting.orchestrator).toEqual([]);
	expect(yield* host.cliStatus()).toMatchObject({ code: 0, stdout: expect.not.stringContaining("Answer failed:") });
	const watched = yield* host.request("daemon.watch", { workIds: ["one"] }).pipe(
		Stream.filter((snapshot) => snapshot.states?.[0]?.stage === "done"),
		Stream.runHead,
		Effect.timeout("5 seconds"),
	);
	const state = Option.getOrThrow(watched).states?.[0];
	expect(state?.blocker).toBeUndefined();
	expect(state?.answerFailure).toBeUndefined();
});
