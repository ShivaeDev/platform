import { expect } from "vitest";
import { jobsStory, signedInAs } from "#test/jobsStory.ts";
import { storedSyncFailure } from "#test/storedSyncFailure.ts";

for (const { description, stored, expected } of [
	{
		description: "an older writer's failure with its secret redacted and its diagnostic fields removed",
		expected: { _tag: "LegacyRejected", message: "sync rejected: password=<redacted>" },
		stored: {
			_tag: "LegacyRejected",
			cause: { message: "cause-secret" },
			message: "sync rejected: password=admin-job-secret",
			stack: "stack-secret",
		},
	},
	{
		description: "a native pg-boss timeout with its full message and default Error tag",
		expected: { _tag: "Error", message: "job timed out" },
		stored: { value: { message: "job timed out" } },
	},
]) {
	jobsStory.it(`an admin reads ${description} in job details`, [signedInAs("admin"), storedSyncFailure(stored)], function* ({ detail }) {
		expect((yield* detail("failed sync", "sync")).output).toEqual(expected);
	});
}
