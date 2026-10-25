import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { readReviewerVerdict } from "#prompt/reviewer.ts";
import type { WireRequest } from "#test/codex.ts";
import { cloudThread, SYNTHETIC_WORKSPACE } from "#test/codexCloud.ts";
import { reviewerProvider, reviewerSessions } from "#test/reviewerStory.ts";

for (const provider of ["local", "cloud"] as const) {
	reviewerSessions.it(
		`${provider} reviewer sessions read PR and CI evidence and return a verdict without network writes or escalation`,
		[reviewerProvider(provider === "cloud")],
		function* ({ sessions: session, replyWith, review }) {
			const requests: WireRequest[] = [];
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
				const head = JSON.parse(yield* review.head());
				expect(head).toEqual({ headRefOid: "a".repeat(40) });
				const diff = yield* review.diff();
				expect(diff).toContain("+export const answer = 42;");
				const checks = yield* review.checks();
				expect(checks.passed).toBe(true);
				review.answer(head.headRefOid, [diff, ...checks.evidence]);
				const observation = yield* session.observe(receipt);
				expect(yield* readReviewerVerdict(observation.output, receipt)).toMatchObject({
					head: "a".repeat(40),
					verdict: "approved",
				});
			});
			const evidenceReadCommands = 2;
			expect(review.commands()).toHaveLength(evidenceReadCommands);
			for (const command of review.commands()) {
				expect(command).toMatchObject({ _tag: "StandardCommand", command: "gh" });
				if (command._tag !== "StandardCommand") {
					throw new Error("Reviewer issued a compound command");
				}
				expect(command.args[0]).toBe("pr");
				expect(["view", "diff"]).toContain(command.args[1]);
			}
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
