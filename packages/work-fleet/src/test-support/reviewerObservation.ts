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
		output: `FLEET_REVIEW: ${JSON.stringify({
			evidence: ["Independent code review"],
			findings: changes ? ["Repair the implementation to meet the task criteria"] : [],
			head: options.wrongHead === "review" ? "wrong-head" : result.head,
			verdict: changes ? "changes" : "approve",
		})}`,
		provisioning: "ready",
		receipt,
	};
}
