import { Effect, Fiber } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { body, WEBHOOK_SECRET } from "#test/fixture.ts";
import { signature } from "#test/requests.ts";
import { inbox } from "#test/story.ts";

inbox.it("a signed GitHub delivery records its receipt and both typed jobs", [], function* ({ deliver, receipts, storedJobs }) {
	expect(yield* deliver()).toEqual({ body: "queued", status: HttpStatus.fromLiteral("Accepted") });
	const rows = yield* receipts();
	const jobs = yield* storedJobs();
	expect(rows).toMatchObject([{ "delivery_id": "delivery-1", event: "issues", outcome: "queued", source: "github" }]);
	expect(rows[0]?.received_at).toBeInstanceOf(Date);
	expect(rows[0]?.job_ids.toSorted()).toEqual(jobs.map(({ id }) => id).toSorted());
	expect(jobs).toMatchObject([
		{ data: { payload: { number: 42 } }, name: "webhook-audit" },
		{ data: { payload: { number: 42 } }, name: "webhook-issue" },
	]);
});

for (const [name, options, status, text] of [
	["missing signature", { signature: null }, HttpStatus.fromLiteral("Unauthorized"), ""],
	["wrong signature before malformed JSON is decoded", { body: "not-json", signature: signature(body) }, HttpStatus.fromLiteral("Unauthorized"), ""],
	["missing delivery ID", { delivery: null }, HttpStatus.fromLiteral("BadRequest"), "Invalid delivery"],
	["missing event header", { event: null }, HttpStatus.fromLiteral("BadRequest"), "Invalid delivery"],
	["rejected payload", { body: JSON.stringify({ issue: { number: "body-must-stay-private" } }) }, HttpStatus.fromLiteral("BadRequest"), ""],
	["oversized body", { body: "x".repeat(257) }, 413, ""],
	["unregistered source", { source: "unknown" }, 404, ""],
] as const) {
	inbox.it(`refuses a ${name} without a receipt or a job`, [], function* ({ deliver, receipts, storedJobs, telemetry }) {
		const response = yield* deliver(options);
		expect(response).toEqual({ body: text, status });
		expect(yield* receipts()).toEqual([]);
		expect(yield* storedJobs()).toEqual([]);
		const captured = JSON.stringify({ response, telemetry: telemetry() });
		for (const value of [WEBHOOK_SECRET, signature(body), body, "body-must-stay-private"]) {
			expect(captured).not.toContain(value);
		}
	});
}

inbox.it("records an unlisted event as ignored without decoding the body", [], function* ({ deliver, receipts, storedJobs }) {
	expect(yield* deliver({ body: "not-json", event: "unlisted" })).toEqual({ body: "ignored", status: HttpStatus.fromLiteral("OK") });
	expect(yield* receipts()).toMatchObject([{ event: "unlisted", "job_ids": [], outcome: "ignored" }]);
	expect(yield* storedJobs()).toEqual([]);
});

inbox.it("records a listed event mapping to no jobs as ignored", [], function* ({ deliver, receipts, storedJobs }) {
	expect(yield* deliver({ body: JSON.stringify({ zen: "Keep it simple" }), event: "ping" })).toEqual({
		body: "ignored",
		status: HttpStatus.fromLiteral("OK"),
	});
	expect(yield* receipts()).toMatchObject([{ event: "ping", "job_ids": [], outcome: "ignored" }]);
	expect(yield* storedJobs()).toEqual([]);
});

inbox.it("answers already queued for a duplicate and keeps the original job IDs", [], function* ({ deliver, receipts, storedJobs }) {
	yield* deliver();
	const original = yield* receipts();
	expect(yield* deliver()).toEqual({ body: "already queued", status: HttpStatus.fromLiteral("OK") });
	expect(yield* receipts()).toEqual(original);
	expect((yield* storedJobs()).map(({ id }) => id).toSorted()).toEqual(original[0]?.job_ids.toSorted());
});

inbox.it("answers already queued for a duplicate ignored event and keeps one receipt", [], function* ({ deliver, receipts }) {
	expect(yield* deliver({ body: "not-json", event: "unlisted" })).toEqual({ body: "ignored", status: HttpStatus.fromLiteral("OK") });
	const original = yield* receipts();
	expect(yield* deliver({ body: "not-json", event: "unlisted" })).toEqual({ body: "already queued", status: HttpStatus.fromLiteral("OK") });
	expect(yield* receipts()).toEqual(original);
});

inbox.it("two concurrent copies enqueue the jobs once", [], function* ({ deliver, receipts, storedJobs }) {
	const responses = yield* Effect.all([deliver(), deliver()], { concurrency: "unbounded" });
	expect(responses.toSorted((a, b) => a.status - b.status)).toEqual([
		{ body: "already queued", status: HttpStatus.fromLiteral("OK") },
		{ body: "queued", status: HttpStatus.fromLiteral("Accepted") },
	]);
	const rows = yield* receipts();
	expect(rows.map(({ delivery_id: id }) => id)).toEqual(["delivery-1"]);
	expect((yield* storedJobs()).map(({ id }) => id).toSorted()).toEqual(rows[0]?.job_ids.toSorted());
});

inbox.it(
	"a failed second enqueue rolls back the first job and receipt, then the retry succeeds",
	[],
	function* ({ deliver, rejectAudit, allowAudit, receipts, storedJobs }) {
		yield* rejectAudit();
		expect(yield* deliver()).toEqual({ body: "", status: HttpStatus.fromLiteral("ServiceUnavailable") });
		expect(yield* receipts()).toEqual([]);
		expect(yield* storedJobs()).toEqual([]);
		yield* allowAudit();
		expect(yield* deliver()).toEqual({ body: "queued", status: HttpStatus.fromLiteral("Accepted") });
		expect(yield* receipts()).toMatchObject([{ "delivery_id": "delivery-1", outcome: "queued" }]);
		expect(yield* storedJobs()).toMatchObject([
			{ data: { payload: { number: 42 } }, name: "webhook-audit" },
			{ data: { payload: { number: 42 } }, name: "webhook-issue" },
		]);
	},
);

inbox.it(
	"a second concurrent copy receives the delivery itself after the first copy rolls back",
	[],
	function* ({ deliver, holdReceiptUpdates, untilCopiesWaitOn, cancelCopyWaitingOnHold, releaseReceiptUpdates, receipts, storedJobs }) {
		yield* holdReceiptUpdates();
		const copies = yield* Effect.all([deliver(), deliver()], { concurrency: "unbounded" }).pipe(Effect.forkChild);
		yield* untilCopiesWaitOn("advisory", "transactionid");
		yield* cancelCopyWaitingOnHold();
		yield* untilCopiesWaitOn("advisory");
		yield* releaseReceiptUpdates();
		const responses = yield* Fiber.join(copies);
		expect(responses.toSorted((a, b) => a.status - b.status)).toEqual([
			{ body: "queued", status: HttpStatus.fromLiteral("Accepted") },
			{ body: "", status: HttpStatus.fromLiteral("ServiceUnavailable") },
		]);
		const rows = yield* receipts();
		expect(rows).toMatchObject([{ "delivery_id": "delivery-1", outcome: "queued" }]);
		expect((yield* storedJobs()).map(({ id }) => id).toSorted()).toEqual(rows[0]?.job_ids.toSorted());
	},
);

inbox.it(
	"a database failure answers 503 without a job, then the retry succeeds",
	[],
	function* ({ deliver, takeReceiptsOffline, restoreReceipts, receipts, storedJobs }) {
		yield* takeReceiptsOffline();
		expect(yield* deliver()).toEqual({ body: "", status: HttpStatus.fromLiteral("ServiceUnavailable") });
		yield* restoreReceipts();
		expect(yield* receipts()).toEqual([]);
		expect(yield* storedJobs()).toEqual([]);
		expect(yield* deliver()).toEqual({ body: "queued", status: HttpStatus.fromLiteral("Accepted") });
	},
);

inbox.it("successful deliveries keep signing credentials and raw bodies out of telemetry", [], function* ({ deliver, telemetry }) {
	const response = yield* deliver();
	expect(response.status).toBe(HttpStatus.fromLiteral("Accepted"));
	const captured = telemetry();
	expect(captured.spans.length).toBeGreaterThan(0);
	for (const value of [WEBHOOK_SECRET, signature(body), body, "unlogged-body-marker"]) {
		expect(JSON.stringify({ captured, response })).not.toContain(value);
	}
});
