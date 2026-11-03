import { Effect, Schema } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue } from "#server/definition.ts";
import { database } from "#test/postgres/database.ts";
import { enqueued, failedByAnOlderWriter, running } from "#test/postgres/traits.ts";

const Failed = defineQueue({ name: "failure-details", queue: { retryLimit: 0 }, schema: Schema.Struct({}) });

for (const wrapped of [false, true]) {
	for (const { message, sanitized, tag } of [
		{ message: "delivery rejected: password=stored-secret", sanitized: "delivery rejected: password=<redacted>", tag: "LegacyRejected" },
		{
			message: "delivery rejected: provider unavailable; try again tomorrow",
			sanitized: "delivery rejected: provider unavailable; try again tomorrow",
			tag: "LegacyRejected",
		},
		{ message: "job timed out", sanitized: "job timed out", tag: undefined },
	]) {
		const failure = { ...(tag === undefined ? {} : { _tag: tag }), cause: { message: "cause-secret" }, message, stack: "stack-secret" };
		const stored = wrapped ? { value: failure } : failure;
		const expected = { _tag: tag ?? "Error", message: sanitized };

		database.it(
			`job details and listings expose ${wrapped ? "a wrapped" : "a direct"} stored failure as ${sanitized} without diagnostic fields`,
			[running("app", [Failed]), enqueued(Failed, {}, { as: "older job" }), failedByAnOlderWriter("older job", stored)],
			function* ({ deadLetterSourceOutput, jobOutput, listedOutputs, listedSourceOutputs }) {
				yield* outcomes([
					["job detail", () => Effect.map(jobOutput("older job"), JSON.stringify), JSON.stringify(expected)],
					["listed failure", () => Effect.map(listedOutputs("app", "failed", Failed), JSON.stringify), JSON.stringify([expected])],
					["dead-letter source detail", () => Effect.map(deadLetterSourceOutput("older job"), JSON.stringify), JSON.stringify(expected)],
					["dead-letter source listing", () => Effect.map(listedSourceOutputs("app", Failed), JSON.stringify), JSON.stringify([expected])],
				]);
			},
		);
	}
}

for (const read of ["detail", "failed listing", "dead-letter listing"] as const) {
	database.it(
		`a ${read} with invalid stored failure output fails with a payload decode error`,
		[running("app", [Failed]), enqueued(Failed, {}, { as: "invalid failure" }), failedByAnOlderWriter("invalid failure", { value: { message: 42 } })],
		function* ({ answered, ask, askForJob }) {
			if (read === "detail") {
				yield* askForJob("invalid failure");
			} else {
				yield* ask("app", `read the ${read}`, (jobs) =>
					read === "failed listing" ? jobs.failedJobs(Failed, { limit: 10 }) : jobs.deadLetteredJobs(Failed, { limit: 10 }),
				);
			}

			expect(yield* answered()).toContain("decode failure-details payload failed with");
		},
	);
}
