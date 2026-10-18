import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { cloudThread } from "#test/codexCloud.ts";
import { cloudRecovery, providerStory } from "#test/providerStory.ts";

for (const state of ["completed", "failed", "interrupted", "inProgress", "unknown", "matching"] as const) {
	providerStory.it(
		`a timed-out continuation reconciles a thread with prior turns: ${state}`,
		[cloudRecovery(1)],
		function* ({ provider, replyWith, requests: wireRequests }) {
			const requests: string[] = [];
			yield* replyWith((request) => {
				requests.push(request.method);
				if (request.method === "thread/read") {
					return cloudThread();
				}
				if (request.method === "turn/start") {
					return { turn: { id: "resubmitted" } };
				}
				return {
					data: [
						{
							id: "existing",
							items: [{ clientId: state === "matching" ? "saved-operation" : "previous-operation", id: "input", type: "userMessage" }],
							status: state === "matching" ? "inProgress" : state,
						},
					],
					nextCursor: null,
				};
			});
			const recovered = yield* provider
				.reconcile({ operationId: "saved-operation", resume: { afterTimeout: true, prompt: "Saved prompt" }, sessionId: "thread" })
				.pipe(Effect.result);
			if (state === "inProgress" || state === "unknown") {
				expect(recovered).toMatchObject({
					_tag: "Failure",
					failure: state === "unknown" ? { reason: "protocol" } : { code: "session-turn-missing" },
				});
				expect(requests).not.toContain("turn/start");
			} else {
				expect(recovered).toMatchObject({
					_tag: "Success",
					success: { sessionId: "thread", turnId: state === "matching" ? "existing" : "resubmitted" },
				});
				expect(requests.filter((method) => method === "turn/start")).toHaveLength(state === "matching" ? 0 : 1);
				if (state !== "matching") {
					expect(wireRequests().find((request) => request.method === "turn/start")?.params).toMatchObject({
						clientUserMessageId: "saved-operation",
						input: [{ text: "Saved prompt" }],
						threadId: "thread",
					});
				}
			}
			expect(requests.find((method) => method !== "initialize")).toBe("thread/turns/list");
			expect(requests).not.toContain("thread/start");
		},
	);
}
