import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { ANSWER_RECORDED } from "#attention.ts";
import { answers, approvedPullRequest } from "#test/answerHost.ts";

const SEED = "Keep keyboard focus.";
const messages = ["Keep the loading indicator visible.", "Preserve the empty state."];

for (const step of ["working", "repairing"] as const) {
	answers.it(`answers during ${step} confirm before admission and queue messages in order after it frees`, [approvedPullRequest], function* (host) {
		const ready = yield* host.readyPullRequest();
		let current = ready;
		if (step === "working") {
			host.setMergeable("CONFLICTING");
			yield* host.reconcile();
			current = yield* host.workerStarted("repair");
			host.setMergeable("MERGEABLE");
		} else {
			current = yield* host.answerPullRequest(ready, "Retain the existing layout.");
		}
		expect(current.step).toBe(step);
		yield* host.answerAndWait(SEED);
		const { release: free } = yield* host.holdAdmission();
		for (const text of messages) {
			const result = yield* host.cliAnswer("one", text).pipe(Effect.timeout("5 seconds"));
			expect(result).toEqual({ code: 0, stderr: "", stdout: `one waiting (waiting on automation): ${ANSWER_RECORDED}` });
		}
		const stored = yield* host.storedRequests();
		expect(stored.map((request) => request.text)).toEqual(messages);
		const pending = yield* host.status();
		expect([...pending.active, ...Object.values(pending.waiting).flat()]).toContainEqual(
			expect.objectContaining({ blocker: ANSWER_RECORDED, workId: "one" }),
		);
		yield* free;
		const queued = yield* host.waitForRecord("one", (record) => record.pendingAnswers?.length === messages.length + 1);
		expect(queued.pendingAnswers).toEqual([SEED, ...messages]);
		expect(queued.attempts).toEqual(current.attempts);
	});
}
