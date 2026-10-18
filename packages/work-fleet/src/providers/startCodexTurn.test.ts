import { expect } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { WireRejection } from "#test/codex.ts";
import { localRequestTimeout, timedProviderStory } from "#test/providerStory.ts";

const input = { operationId: "operation", prompt: "Continue", sessionId: "thread" };
for (const observationDelay of [0, 299_000]) {
	timedProviderStory.it(
		`idle busy rejections respect the resubmission limit and original deadline: observationDelay=${observationDelay}`,
		[localRequestTimeout(600_000)],
		function* ({ provider, replyWith, requests, awaitSleep, replyAfter }) {
			yield* replyWith((request) => {
				if (request.method === "turn/start") {
					return new WireRejection("turn already active for thread");
				}
				if (request.method === "thread/turns/list" && observationDelay > 0) {
					return replyAfter(observationDelay, { data: [], nextCursor: null });
				}
				return { data: [], nextCursor: null };
			});
			const submitting = yield* provider.startTurn(input).pipe(Effect.flip, Effect.forkChild);
			if (observationDelay > 0) {
				yield* awaitSleep(observationDelay);
				yield* TestClock.adjust(observationDelay);
				yield* awaitSleep(1000);
				yield* TestClock.adjust(1000);
			} else {
				yield* awaitSleep(5000);
			}
			if (observationDelay === 0) {
				yield* TestClock.adjust(5000);
				yield* awaitSleep(10_000);
				yield* TestClock.adjust(10_000);
				yield* awaitSleep(20_000);
				yield* TestClock.adjust(20_000);
			}
			const error = yield* Fiber.join(submitting);
			expect(error.reason).toBe("rejected");
			const submissions = requests().filter((request) => request.method === "turn/start");
			if (observationDelay === 0) {
				expect(error.code).toBe("session-active-turn-exhausted");
				expect(submissions).toHaveLength(4);
				expect(submissions.map((request) => request.params)).toEqual(
					Array.from({ length: 4 }, () => ({
						clientUserMessageId: input.operationId,
						input: [{ text: input.prompt, "text_elements": [], type: "text" }],
						threadId: input.sessionId,
					})),
				);
			} else {
				expect(error.message).toContain("active-turn wait deadline reached");
				expect(submissions).toHaveLength(1);
			}
		},
	);
}

timedProviderStory.it("idle busy rejections back off before the same turn starts", [], function* ({ provider, replyWith, requests, awaitSleep }) {
	let attempts = 0;
	yield* replyWith((request) => {
		if (request.method !== "turn/start") {
			return { data: [], nextCursor: null };
		}
		attempts += 1;
		return attempts < 3 ? new WireRejection("turn already active for thread") : { turn: { id: "followup" } };
	});
	const submitting = yield* provider.startTurn(input).pipe(Effect.forkChild);
	yield* awaitSleep(5000);
	expect(requests().filter((request) => request.method === "turn/start")).toHaveLength(1);
	yield* TestClock.adjust(4999);
	expect(requests().filter((request) => request.method === "turn/start")).toHaveLength(1);
	yield* TestClock.adjust(1);
	yield* awaitSleep(10_000);
	expect(requests().filter((request) => request.method === "turn/start")).toHaveLength(2);
	yield* TestClock.adjust(10_000);
	expect(yield* Fiber.join(submitting)).toEqual({ sessionId: "thread", turnId: "followup" });
	const submissions = requests().filter((request) => request.method === "turn/start");
	expect(submissions.map((request) => request.params)).toEqual(
		Array.from({ length: 3 }, () => ({
			clientUserMessageId: input.operationId,
			input: [{ text: input.prompt, "text_elements": [], type: "text" }],
			threadId: input.sessionId,
		})),
	);
});

timedProviderStory.it("an invalid request does not check contention or resubmit", [], function* ({ provider, replyWith, requests }) {
	yield* replyWith((request) => (request.method === "turn/start" ? new WireRejection("Invalid request") : {}));
	const error = yield* provider.startTurn(input).pipe(Effect.flip);
	expect(error.code).toBe("session-rejected");
	expect(
		requests()
			.filter((request) => request.method.startsWith("turn/") || request.method === "thread/turns/list")
			.map((request) => request.method),
	).toEqual(["turn/start"]);
});
