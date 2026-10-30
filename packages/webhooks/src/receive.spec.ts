import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import type { Delivery } from "#test/requests.ts";
import { auditEnqueueFails, delivered, firstReceiptUpdateFails, inbox } from "#test/story.ts";

const issue42Jobs = ["webhook-audit for issue 42", "webhook-issue for issue 42"];
const queuedReceipt = { delivery: "delivery-1", event: "issues", jobs: issue42Jobs, outcome: "queued" as const, source: "github" };

inbox.it(
	"the signed issue 42 delivery is answered queued, stores a queued receipt naming its jobs and hands issue 42 to both workers",
	[],
	function* ({ answer, deliver, handledJobs, spanNames, storedReceipts }) {
		yield* deliver("the signed issue 42 delivery");

		yield* outcomes({
			"answer": [answer(), "202 Accepted: queued"],
			"handled jobs": [handledJobs(), issue42Jobs],
			"spans recorded": [spanNames(), expect.arrayContaining(["POST", "Webhooks.receive"])],
			"stored receipts": [storedReceipts(), [queuedReceipt]],
		});
	},
);

const refusals: ReadonlyArray<readonly [Delivery, string]> = [
	["a delivery without a signature", "401 Unauthorized"],
	["a non-JSON delivery signed for another body", "401 Unauthorized"],
	["a delivery without a delivery ID", "400 Bad Request: Invalid delivery"],
	["a delivery without an event header", "400 Bad Request: Invalid delivery"],
	["an issue delivery whose number is a string", "400 Bad Request"],
	["a delivery over the host's 256-byte limit", "413 Payload Too Large"],
	["a delivery to an unregistered source", "404 Not Found"],
];

for (const [delivery, refusal] of refusals) {
	inbox.it(
		`${delivery} is answered ${refusal}, stores no receipt and queues no job`,
		[],
		function* ({ answer, deliver, handledJobs, storedReceipts }) {
			yield* deliver(delivery);

			yield* outcomes({
				"answer": [answer(), refusal],
				"handled jobs": [handledJobs(), []],
				"stored receipts": [storedReceipts(), []],
			});
		},
	);
}

for (const delivery of ["the signed issue 42 delivery", ...refusals.map(([refused]) => refused)] as const) {
	inbox.it(
		`${delivery} records the request's span but keeps the signing key, signature and body out of the answer, logs and spans`,
		[],
		function* ({ deliver, secretsSeenIn, spanNames }) {
			yield* deliver(delivery);

			yield* outcomes({
				"secrets seen in": [secretsSeenIn(), {}],
				"spans recorded": [spanNames(), expect.arrayContaining(["POST"])],
			});
		},
	);
}

inbox.it(
	"an unlisted event whose body is not JSON is answered ignored without decoding and stores an ignored receipt with no jobs",
	[],
	function* ({ answer, deliver, storedReceipts }) {
		yield* deliver("an unlisted event whose body is not JSON");

		yield* outcomes({
			"answer": [answer(), "200 OK: ignored"],
			"stored receipts": [storedReceipts(), [{ delivery: "delivery-1", event: "unlisted", jobs: [], outcome: "ignored", source: "github" }]],
		});
	},
);

inbox.it(
	"a ping, whose event maps to no jobs, is answered ignored and stores an ignored receipt",
	[],
	function* ({ answer, deliver, storedReceipts }) {
		yield* deliver("a ping");

		yield* outcomes({
			"answer": [answer(), "200 OK: ignored"],
			"stored receipts": [storedReceipts(), [{ delivery: "delivery-1", event: "ping", jobs: [], outcome: "ignored", source: "github" }]],
		});
	},
);

inbox.it(
	"a repeated issue 42 delivery is answered already queued, keeps its one receipt and queues no second job",
	[delivered("the signed issue 42 delivery")],
	function* ({ answer, deliver, handledJobs, storedReceipts }) {
		yield* deliver("the signed issue 42 delivery");

		yield* outcomes({
			"answer": [answer(), "200 OK: already queued"],
			"handled jobs": [handledJobs(), issue42Jobs],
			"stored receipts": [storedReceipts(), [queuedReceipt]],
		});
	},
);

inbox.it(
	"a repeated unlisted event is answered already queued and keeps its one ignored receipt",
	[delivered("an unlisted event whose body is not JSON")],
	function* ({ answer, deliver, storedReceipts }) {
		yield* deliver("an unlisted event whose body is not JSON");

		yield* outcomes({
			"answer": [answer(), "200 OK: already queued"],
			"stored receipts": [storedReceipts(), [{ delivery: "delivery-1", event: "unlisted", jobs: [], outcome: "ignored", source: "github" }]],
		});
	},
);

inbox.it(
	"of two copies sent at once, the one waiting on the other's receipt is answered already queued, and one queued receipt hands issue 42 to each worker once",
	[],
	function* ({ answers, deliverTwoCopiesTogether, handledJobs, storedReceipts }) {
		yield* deliverTwoCopiesTogether();

		yield* outcomes({
			"answers": [answers(), ["200 OK: already queued", "202 Accepted: queued"]],
			"handled jobs": [handledJobs(), issue42Jobs],
			"stored receipts": [storedReceipts(), [queuedReceipt]],
		});
	},
);

inbox.it(
	"when the first of two copies sent at once fails after the second waits on its receipt, the first is answered unavailable and the second stores the queued receipt and hands issue 42 to each worker once",
	[firstReceiptUpdateFails],
	function* ({ answers, deliverTwoCopiesTogether, handledJobs, storedReceipts }) {
		yield* deliverTwoCopiesTogether();

		yield* outcomes({
			"answers": [answers(), ["202 Accepted: queued", "503 Service Unavailable"]],
			"handled jobs": [handledJobs(), issue42Jobs],
			"stored receipts": [storedReceipts(), [queuedReceipt]],
		});
	},
);

inbox.it(
	"after a failed audit enqueue answered unavailable, the sender's retry is answered queued",
	[auditEnqueueFails, delivered("the signed issue 42 delivery")],
	function* ({ answer, deliver }) {
		expect(yield* answer()).toBe("503 Service Unavailable");

		yield* deliver("the signed issue 42 delivery");

		expect(yield* answer()).toBe("202 Accepted: queued");
	},
);
