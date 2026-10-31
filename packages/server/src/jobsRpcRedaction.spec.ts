import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { jobsRedaction, registeredJobs } from "#test/app-host/jobsRedaction.ts";

for (const [failure, message] of [
	["Forbidden", "You cannot edit this job"],
	["Conflict", "Name is taken"],
	["QueryReadDenied", "You cannot read this job"],
] as const) {
	jobsRedaction.it(`registering Jobs preserves the native client's ${failure} tag and message`, [registeredJobs], function* ({ typedFailure }) {
		expect(yield* typedFailure(failure)).toEqual({ _tag: failure, message });
	});
}

jobsRedaction.it(
	"a job failure redacts its private payload and failure detail while preserving job metadata",
	[registeredJobs],
	function* ({ callRpc, wireAnswers, answerMentions }) {
		yield* callRpc("jobFailure", null);

		yield* outcomes([
			[
				"job failure",
				() => wireAnswers(),
				{ "1": { failed: expect.objectContaining({ data: "<redacted>", output: "<redacted>", queue: "mail", state: "failed" }) } },
			],
			["private payload on the wire", () => answerMentions("private-recipient@example.test", "private job failure detail"), []],
		]);
	},
);
