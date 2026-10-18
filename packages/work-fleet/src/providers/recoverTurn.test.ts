import { expect } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { requestCursor, WireRejection } from "#test/codex.ts";
import { cloudThread } from "#test/codexCloud.ts";
import { cloudRecovery, providerStory, timedProviderStory } from "#test/providerStory.ts";
import { uncertainEvidence } from "#test/recoveryEvidence.ts";

const input = {
	operationId: "operation",
	resume: { access: "read-only" as const, prompt: "Approved work", settings: { effort: "high", model: "synthetic-model", serviceTier: "priority" } },
	sessionId: "synthetic-session",
};
timedProviderStory.it(
	"waits the bounded grace period and concurrent recovery starts once on the acknowledged empty thread",
	[cloudRecovery(5000)],
	function* ({ provider, replyWith, requests, awaitSleep }) {
		yield* replyWith((request) => {
			if (request.method === "thread/read") {
				return cloudThread();
			}
			if (request.method === "turn/start") {
				return { turn: { id: "synthetic-turn" } };
			}
			return { data: [], nextCursor: null };
		});
		const recovering = yield* Effect.all([provider.reconcile(input), provider.reconcile(input)], { concurrency: "unbounded" }).pipe(Effect.forkChild);
		for (let step = 0; step < 19; step += 1) {
			yield* awaitSleep(250);
			yield* TestClock.adjust(250);
		}
		yield* awaitSleep(250);
		yield* TestClock.adjust(249);
		expect(requests().map((request) => request.method)).not.toContain("turn/start");
		yield* TestClock.adjust(1);
		expect(yield* Fiber.join(recovering)).toEqual([
			{ sessionId: input.sessionId, turnId: "synthetic-turn" },
			{ sessionId: input.sessionId, turnId: "synthetic-turn" },
		]);
		const starts = requests().filter((request) => request.method === "turn/start");
		expect(starts).toHaveLength(1);
		expect(starts[0]?.params).toMatchObject({
			...input.resume.settings,
			approvalPolicy: "never",
			clientUserMessageId: input.operationId,
			input: [{ text: input.resume.prompt, type: "text" }],
			sandboxPolicy: { networkAccess: true, type: "readOnly" },
			threadId: input.sessionId,
		});
		expect(requests().map((request) => request.method)).not.toContain("thread/start");
	},
);

for (const scenario of uncertainEvidence) {
	providerStory.it(`retains ownership without replay for ${scenario}`, [cloudRecovery(1)], function* ({ provider, replyWith, requests }) {
		yield* replyWith((request) => {
			if (request.method === "thread/read") {
				return cloudThread();
			}
			const cursor = requestCursor(request);
			if (scenario === "missing-thread" || (scenario === "broken-page" && cursor === "second")) {
				return new WireRejection("Thread evidence is unavailable");
			}
			const matching = { id: "turn", items: [{ clientId: "operation", id: "input", type: "userMessage" }], status: "inProgress" };
			if (scenario === "duplicates") {
				return { data: [matching, { ...matching, id: "other" }], nextCursor: null };
			}
			if (scenario === "unrelated") {
				return { data: [{ ...matching, items: [] }], nextCursor: null };
			}
			return { data: [], nextCursor: scenario === "broken-page" ? "second" : null };
		});
		const result = yield* provider
			.reconcile({
				...input,
				...(scenario === "missing-session" ? { sessionId: undefined } : {}),
				...(scenario === "missing-prompt" ? { resume: undefined } : {}),
			})
			.pipe(Effect.result);
		expect(result._tag).toBe("Failure");
		expect(requests().map((request) => request.method)).not.toContain("thread/start");
		expect(requests().map((request) => request.method)).not.toContain("turn/start");
	});
}
