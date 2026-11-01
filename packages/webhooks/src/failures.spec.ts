import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import type { Delivery } from "#test/requests.ts";
import { auditEnqueueFails, inbox, receiptsTableGone } from "#test/story.ts";

const mappingFailures: ReadonlyArray<readonly [Delivery, string]> = [
	["a delivery whose mapping fails with a schema error", "SchemaError"],
	["a delivery whose mapping fails with a frozen error", "MappingUnavailable"],
	["a delivery whose mapping fails with a body limit error", "RequestBodyTooLarge"],
	["a delivery whose mapping fails with an unauthorized error", "WebhookUnauthorized"],
];

for (const [delivery, tag] of mappingFailures) {
	inbox.it(
		`${delivery} is logged with ${tag}, answers unavailable and rolls back without queuing jobs`,
		[],
		function* ({ answer, deliver, errorLogs, handledJobs, requestOutcomes, secretsSeenIn, storedReceipts }) {
			yield* deliver(delivery);

			yield* outcomes([
				["answer", () => answer(), "503 Service Unavailable"],
				[
					"error logs",
					() => errorLogs(),
					[
						expect.objectContaining({
							annotations: expect.objectContaining({ errorTag: tag }),
							cause: expect.stringContaining(tag),
							level: "Error",
						}),
					],
				],
				["handled jobs", () => handledJobs(), []],
				["request spans", () => requestOutcomes(), [{ failure: expect.stringContaining(tag), outcome: "failed", response: 503 }]],
				["secrets seen in", () => secretsSeenIn(), {}],
				["stored receipts", () => storedReceipts(), []],
			]);
		},
	);
}

inbox.it(
	"a delivery the receipts table cannot record logs SqlError, fails its request span and answers unavailable without exposing delivery secrets",
	[receiptsTableGone],
	function* ({ answer, deliver, errorLogs, handledJobs, requestOutcomes, secretsSeenIn }) {
		yield* deliver("the signed issue 42 delivery");

		yield* outcomes([
			["answer", () => answer(), "503 Service Unavailable"],
			[
				"error logs",
				() => errorLogs(),
				[
					expect.objectContaining({
						annotations: expect.objectContaining({ errorTag: "SqlError" }),
						cause: expect.stringContaining("SqlError"),
						level: "Error",
					}),
				],
			],
			["handled jobs", () => handledJobs(), []],
			["request spans", () => requestOutcomes(), [{ failure: expect.stringContaining("SqlError"), outcome: "failed", response: 503 }]],
			["secrets seen in", () => secretsSeenIn(), {}],
		]);
	},
);

inbox.it(
	"an audit enqueue failing after the issue job logs PgBossError, fails its request span, answers unavailable and rolls back the receipt and jobs",
	[auditEnqueueFails],
	function* ({ answer, deliver, errorLogs, handledJobs, requestOutcomes, secretsSeenIn, storedReceipts }) {
		yield* deliver("the signed issue 42 delivery");

		yield* outcomes([
			["answer", () => answer(), "503 Service Unavailable"],
			[
				"error logs",
				() => errorLogs(),
				[
					expect.objectContaining({
						annotations: expect.objectContaining({ errorTag: "PgBossError" }),
						cause: expect.stringContaining("PgBossError"),
						level: "Error",
					}),
				],
			],
			["handled jobs", () => handledJobs(), []],
			["request spans", () => requestOutcomes(), [{ failure: expect.stringContaining("PgBossError"), outcome: "failed", response: 503 }]],
			["secrets seen in", () => secretsSeenIn(), {}],
			["stored receipts", () => storedReceipts(), []],
		]);
	},
);
