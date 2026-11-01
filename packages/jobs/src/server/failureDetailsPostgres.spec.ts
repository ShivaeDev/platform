import { Effect, Schema } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue } from "#definition.ts";
import { database } from "#test/postgres/database.ts";
import { enqueued, failedByAnOlderWriter, running } from "#test/postgres/traits.ts";

const Failed = defineQueue({ name: "failure-details", queue: { retryLimit: 0 }, schema: Schema.Struct({}) });

for (const { message, sanitized } of [
	{ message: "delivery rejected: password=stored-secret", sanitized: "delivery rejected: password=<redacted>" },
	{
		message: "delivery rejected: provider unavailable; try again tomorrow",
		sanitized: "delivery rejected: provider unavailable; try again tomorrow",
	},
]) {
	const stored = { _tag: "LegacyRejected", cause: { message: "cause-secret" }, message, stack: "stack-secret" };
	const expected = { _tag: "LegacyRejected", message: sanitized };

	database.it(
		`job details and listings expose an older writer's failure as ${sanitized} without diagnostic fields`,
		[running("app", [Failed]), enqueued(Failed, {}, { as: "older job" }), failedByAnOlderWriter("older job", stored)],
		function* ({ deadLetterSourceOutput, jobOutput, listedOutputs, storedOutput }) {
			yield* outcomes([
				["stored failure", () => storedOutput("older job"), stored],
				["job detail", () => Effect.map(jobOutput("older job"), JSON.stringify), JSON.stringify(expected)],
				["listed failure", () => listedOutputs("app", "failed", Failed), [expected]],
				["dead-letter source detail", () => Effect.map(deadLetterSourceOutput("older job"), JSON.stringify), JSON.stringify(expected)],
			]);
		},
	);
}
