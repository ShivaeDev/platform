import { Schema } from "effect";
import { WorkResult } from "#policy.ts";
import type { SessionObservation, SessionReceipt } from "#session/schema.ts";
import type { EngineOptions } from "#test/EngineOptions.ts";

export function reviewerObservation(options: EngineOptions, prompt: string, receipt: SessionReceipt, reviews: string[]): SessionObservation {
	const target = prompt
		.split("\n")
		.find((line) => line.startsWith("Review target: "))
		?.slice("Review target: ".length);
	const result = Schema.decodeUnknownSync(Schema.fromJsonString(WorkResult))(target);
	const changes = options.repairs === true && reviews.length === 0;
	reviews.push(result.head);
	return {
		execution: options.reviewExecution ?? (options.reviewRunning ? "running" : "completed"),
		output: `## TL;DR\n\nVerdict: ${changes ? "request changes\n- Repair the implementation to meet the task criteria." : "approve. No findings worth raising."}\n\n## Details\n\n${changes ? "Claim: Missing behavior. Evidence: Exact diff. Likelihood in real use: likely. Impact: Task incomplete. Suggested fix: Implement the missing behavior." : "None."}\n\nFLEET_REVIEW: ${JSON.stringify(
			{
				evidence: ["Independent code review"],
				findings: changes ? ["Repair the implementation to meet the task criteria"] : [],
				head: options.wrongHead === "review" ? "wrong-head" : result.head,
				verdict: changes ? "changes" : "approve",
			},
		)}`,
		provisioning: "ready",
		receipt,
	};
}
