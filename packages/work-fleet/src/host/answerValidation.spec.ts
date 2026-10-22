import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { approvedWork, host } from "#test/hostStory.ts";

for (const worker of [false, true]) {
	for (const release of [false, true]) {
		host.it(
			`oversized text leaves no response and permits a later valid answer with worker=${worker}, release=${release}`,
			[approvedWork(["one"])],
			function* (daemon) {
				const started = yield* daemon.dispatch("one");
				daemon.finishTurn(started, worker ? "FLEET_QUESTION: Which storage should I use?" : undefined);
				const waiting = yield* daemon.reconcile("one");
				const error = yield* daemon.answer("one", "x".repeat(32_769), release).pipe(Effect.flip);
				expect(daemon.responseFiles()).toEqual([]);
				expect(daemon.receiptFiles()).toEqual([]);
				expect(error).toMatchObject({ _tag: "BadRequest", message: expect.stringContaining("32768") });
				const rejected = yield* daemon.get("one");
				expect(rejected.decision).toEqual(waiting.decision);
				expect(rejected.responses).toEqual(waiting.responses);
				const text = "v".repeat(32_768);
				const answered = yield* daemon.answer("one", text, release);
				const step = worker ? "working" : "adopting";
				expect(answered.step).toBe(release ? "released" : step);
				expect(answered.responses?.at(-1)).toMatchObject({ boardAcknowledged: true });
				expect(daemon.receiptFiles()).toHaveLength(1);
				if (worker && !release) {
					expect(answered.attempts.at(-1)?.prompt).toBe(text);
					expect(answered.attempts.at(-1)?.receipt?.sessionId).toBe(started.attempts[0]?.receipt?.sessionId);
				}
			},
		);
	}
}
