import { expect } from "@effect/vitest";
import { Clock, Effect, Fiber } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { it } from "@shivaedev/effect-test/it.ts";
import { type CodexRequest, codexTurns } from "#providers/codexTurns.ts";
import { startCodexTurn } from "#providers/startCodexTurn.ts";
import { SessionFailure } from "#session/schema.ts";

for (const observationDelay of [0, 299_000]) {
	it.effect(`idle busy rejections respect the resubmission limit and original deadline: observationDelay=${observationDelay}`, function* () {
		const times: number[] = [];
		const submissions: unknown[] = [];
		const rpc: CodexRequest = (method, requestParams) =>
			Effect.gen(function* () {
				if (method === "turn/start") {
					times.push(yield* Clock.currentTimeMillis);
					submissions.push(requestParams);
					return yield* new SessionFailure({ code: "session-rejected", message: "turn already active for thread", reason: "rejected" });
				}
				yield* Effect.sleep(observationDelay);
				return { data: [], nextCursor: null };
			});
		const params = { clientUserMessageId: "operation", input: [{ text: "Continue", type: "text" }], threadId: "thread" };
		const submitting = yield* startCodexTurn(rpc, codexTurns(rpc).waitUntilIdle)("thread", params).pipe(Effect.flip, Effect.forkChild);
		yield* TestClock.adjust(observationDelay === 0 ? "35 seconds" : "5 minutes");
		const error = yield* Fiber.join(submitting);
		expect(error.reason).toBe("rejected");
		if (observationDelay === 0) {
			expect(error.code).toBe("session-active-turn-exhausted");
			expect(times).toEqual([0, 5000, 15_000, 35_000]);
			expect(submissions).toEqual([params, params, params, params]);
		} else {
			expect(error.message).toContain("active-turn wait deadline reached");
			expect(times).toEqual([0]);
		}
	});
}

it.effect("an unrelated rejection on an idle thread does not authorize resubmission", function* () {
	const methods: string[] = [];
	const rpc: CodexRequest = (method) =>
		Effect.suspend(() => {
			methods.push(method);
			return method === "turn/start"
				? Effect.fail(new SessionFailure({ code: "session-rejected", message: "Invalid request", reason: "rejected" }))
				: Effect.succeed({ data: [], nextCursor: null });
		});
	const error = yield* startCodexTurn(rpc, codexTurns(rpc).waitUntilIdle)("thread", { threadId: "thread" }).pipe(Effect.flip);
	expect(error.code).toBe("session-rejected");
	expect(methods).toEqual(["turn/start", "thread/turns/list"]);
});
