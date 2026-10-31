import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { reviewerProvider, reviewerSessions } from "#test/reviewerStory.ts";

const PR = "https://github.com/example/project/pull/7";
const READ_ONLY_THREAD = {
	cloud: expect.objectContaining({
		config: expect.objectContaining({
			"approval_policy": "never",
			"sandbox_mode": "read-only",
			"sandbox_read_only.network_access": true,
		}),
	}),
	local: expect.objectContaining({
		approvalPolicy: "never",
		config: expect.objectContaining({ "sandbox_read_only.network_access": true }),
		sandbox: "read-only",
	}),
};

for (const provider of ["local", "cloud"] as const) {
	reviewerSessions.it(
		`a ${provider} reviewer runs read-only with network reads and no approvals, and returns its verdict from PR and CI reads`,
		[reviewerProvider(provider === "cloud")],
		function* ({ commands, reviewerReadsEvidence, sent, startReview, verdict }) {
			const receipt = yield* startReview();

			yield* reviewerReadsEvidence();

			yield* outcomes([
				["verdict", () => verdict(receipt), expect.objectContaining({ head: "a".repeat(40), verdict: "approved" })],
				[
					"GitHub commands",
					() => commands(),
					[
						expect.objectContaining({ args: ["pr", "view", PR, "--json", "headRefOid"], command: "gh" }),
						expect.objectContaining({ args: ["pr", "diff", PR], command: "gh" }),
					],
				],
				["thread access", () => sent("thread/start"), [READ_ONLY_THREAD[provider]]],
				[
					"turn access",
					() => sent("turn/start"),
					[
						expect.objectContaining({
							approvalPolicy: "never",
							sandboxPolicy: { networkAccess: true, type: "readOnly" },
							threadId: "reviewer",
						}),
					],
				],
			]);
		},
	);
}
