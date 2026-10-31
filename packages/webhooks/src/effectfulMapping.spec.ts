import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { delivered, inbox, senderOptIn, senderPreferencesGone } from "#test/story.ts";

inbox.it(
	"an opted-in sender's delivery is accepted after checking the database and clock",
	[senderOptIn("future")],
	function* ({ answer, deliver, handledJobs, storedReceipts }) {
		yield* deliver("a delivery requiring sender opt-in");

		yield* outcomes({
			"answer": [answer(), "202 Accepted: queued"],
			"handled jobs": [handledJobs(), ["webhook-issue for issue 42"]],
			"stored receipts": [
				storedReceipts(),
				[{ delivery: "delivery-1", event: "opted_in_issues", jobs: ["webhook-issue for issue 42"], outcome: "queued", source: "github" }],
			],
		});
	},
);

inbox.it(
	"a sender whose opt-in expired is answered ignored and queues no job",
	[senderOptIn("past")],
	function* ({ answer, deliver, handledJobs, storedReceipts }) {
		yield* deliver("a delivery requiring sender opt-in");

		yield* outcomes({
			"answer": [answer(), "200 OK: ignored"],
			"handled jobs": [handledJobs(), []],
			"stored receipts": [storedReceipts(), [{ delivery: "delivery-1", event: "opted_in_issues", jobs: [], outcome: "ignored", source: "github" }]],
		});
	},
);

inbox.it(
	"a failing sender check reports its typed failure and rolls back the receipt without enqueuing",
	[],
	function* ({ answer, deliver, errorLogs, handledJobs, requestOutcomes, storedReceipts }) {
		yield* deliver("a delivery requiring sender opt-in");

		yield* outcomes({
			"answer": [answer(), "503 Service Unavailable"],
			"error logs": [errorLogs(), [expect.objectContaining({ annotations: expect.objectContaining({ errorTag: "SenderCheckFailed" }) })]],
			"handled jobs": [handledJobs(), []],
			"request spans": [requestOutcomes(), [{ failure: expect.stringContaining("SenderCheckFailed"), outcome: "failed", response: 503 }]],
			"stored receipts": [storedReceipts(), []],
		});
	},
);

inbox.it(
	"a recorded delivery skips the sender check when its preferences become unavailable",
	[senderOptIn("future"), delivered("a delivery requiring sender opt-in"), senderPreferencesGone],
	function* ({ answer, deliver, errorLogs, handledJobs, storedReceipts }) {
		yield* deliver("a delivery requiring sender opt-in");

		yield* outcomes({
			"answer": [answer(), "200 OK: already queued"],
			"error logs": [errorLogs(), []],
			"handled jobs": [handledJobs(), ["webhook-issue for issue 42"]],
			"stored receipts": [
				storedReceipts(),
				[{ delivery: "delivery-1", event: "opted_in_issues", jobs: ["webhook-issue for issue 42"], outcome: "queued", source: "github" }],
			],
		});
	},
);
