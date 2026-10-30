import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { auditEnqueueFails, inbox, receiptsTableGone } from "#test/story.ts";

inbox.it(
	"a delivery the receipts table cannot record logs SqlError, fails its request span and answers unavailable without exposing delivery secrets",
	[receiptsTableGone],
	function* ({ answer, deliver, errorLogs, handledJobs, requestOutcomes, secretsSeenIn }) {
		yield* deliver("the signed issue 42 delivery");

		yield* outcomes({
			"answer": [answer(), "503 Service Unavailable"],
			"error logs": [
				errorLogs(),
				[
					expect.objectContaining({
						annotations: expect.objectContaining({ errorTag: "SqlError" }),
						cause: expect.stringContaining("SqlError"),
						level: "Error",
					}),
				],
			],
			"handled jobs": [handledJobs(), []],
			"request spans": [requestOutcomes(), [{ failure: expect.stringContaining("SqlError"), outcome: "failed", response: 503 }]],
			"secrets seen in": [secretsSeenIn(), {}],
		});
	},
);

inbox.it(
	"an audit enqueue failing after the issue job logs PgBossError, fails its request span, answers unavailable and rolls back the receipt and jobs",
	[auditEnqueueFails],
	function* ({ answer, deliver, errorLogs, handledJobs, requestOutcomes, secretsSeenIn, storedReceipts }) {
		yield* deliver("the signed issue 42 delivery");

		yield* outcomes({
			"answer": [answer(), "503 Service Unavailable"],
			"error logs": [
				errorLogs(),
				[
					expect.objectContaining({
						annotations: expect.objectContaining({ errorTag: "PgBossError" }),
						cause: expect.stringContaining("PgBossError"),
						level: "Error",
					}),
				],
			],
			"handled jobs": [handledJobs(), []],
			"request spans": [requestOutcomes(), [{ failure: expect.stringContaining("PgBossError"), outcome: "failed", response: 503 }]],
			"secrets seen in": [secretsSeenIn(), {}],
			"stored receipts": [storedReceipts(), []],
		});
	},
);
