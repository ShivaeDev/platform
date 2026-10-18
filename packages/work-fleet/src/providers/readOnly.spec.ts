import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { readReviewerVerdict } from "#prompt/reviewer.ts";
import type { WireRequest } from "#test/codex.ts";
import { cloudThread, SYNTHETIC_WORKSPACE } from "#test/codexCloud.ts";
import { providerSessions, sessionProvider } from "#test/providerSessionStory.ts";
import { reviewerNetwork } from "#test/reviewerNetwork.ts";

for (const provider of ["local", "cloud"] as const) {
	providerSessions.it(
		`${provider} reviewer sessions read PR and CI evidence and return a verdict without network writes or escalation`,
		[sessionProvider(provider === "cloud")],
		function* ({ sessions: session, replyWith }) {
			const requests: WireRequest[] = [];
			const review = reviewerNetwork();
			yield* replyWith((request) => {
				requests.push(request);
				switch (request.method) {
					case "thread/start":
						return { thread: { id: "reviewer" } };
					case "thread/read":
						return cloudThread();
					default:
						return review.reply(request);
				}
			});
			yield* Effect.gen(function* () {
				const receipt = yield* session.start({
					access: "read-only",
					cwd: SYNTHETIC_WORKSPACE,
					operationId: "review",
					prompt: review.prompt,
				});
				expect(receipt).toEqual({ sessionId: "reviewer", turnId: "review-turn" });
				yield* review.inspect;
				const observation = yield* session.observe(receipt);
				expect(yield* readReviewerVerdict(observation.output, receipt)).toMatchObject({
					head: "a".repeat(40),
					verdict: "approved",
				});
			});
			const start = requests.find((request) => request.method === "thread/start")?.params;
			expect(start).toMatchObject(
				provider === "cloud"
					? { config: { "approval_policy": "never", "sandbox_mode": "read-only", "sandbox_read_only.network_access": true } }
					: { approvalPolicy: "never", config: { "sandbox_read_only.network_access": true }, sandbox: "read-only" },
			);
			expect(requests.find((request) => request.method === "turn/start")?.params).toMatchObject({
				approvalPolicy: "never",
				sandboxPolicy: { networkAccess: true, type: "readOnly" },
				threadId: "reviewer",
			});
		},
	);
}
