import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { PRIVATE_FIELD, WEBHOOK_SECRET } from "#test/fixture.ts";
import type { Delivery } from "#test/requests.ts";
import { delivered, inbox, telemetryCollector } from "#test/story.ts";

inbox.it(
	"a signed payload stores only receipt metadata and mapped job data and exports no payload content",
	[telemetryCollector],
	function* ({ deliver, exportedTelemetry, secretsSeenIn, storedData }) {
		yield* deliver("the signed issue 42 delivery");

		const { receipts, jobs } = yield* storedData();
		expect(receipts).toEqual([
			{
				"delivery_id": "delivery-1",
				event: "issues",
				"job_ids": [expect.any(String), expect.any(String)],
				outcome: "queued",
				"received_at": expect.any(Date),
				source: "github",
			},
		]);
		expect(jobs).toEqual(
			["webhook-audit", "webhook-issue"].map((name) => ({
				data: { number: 42 },
				name,
			})),
		);
		const exported = yield* exportedTelemetry();
		expect(exported).toContain("Webhooks.receive");
		expect(exported).not.toContain(PRIVATE_FIELD);
		expect(exported).not.toContain(WEBHOOK_SECRET);
		expect(yield* secretsSeenIn()).toEqual([]);
	},
);

inbox.it(
	"an unlisted private body is ignored without storing or exporting its content",
	[telemetryCollector],
	function* ({ answer, deliver, exportedTelemetry, secretsSeenIn, storedData }) {
		yield* deliver("an unlisted event with private content");

		const stored = yield* storedData();
		expect(stored).toEqual({
			jobs: [],
			receipts: [
				{ "delivery_id": "delivery-1", event: "unlisted", "job_ids": [], outcome: "ignored", "received_at": expect.any(Date), source: "github" },
			],
		});
		yield* outcomes([
			["answer", answer, "200 OK: ignored"],
			["exported telemetry", exportedTelemetry, expect.stringContaining("Webhooks.receive")],
			["private data seen in", secretsSeenIn, []],
		]);
	},
);

inbox.it(
	"a duplicate private payload exports no content",
	[telemetryCollector, delivered("the signed issue 42 delivery")],
	function* ({ answer, deliver, exportedTelemetry, secretsSeenIn }) {
		yield* deliver("the signed issue 42 delivery");

		yield* outcomes([
			["answer", answer, "200 OK: already queued"],
			["exported telemetry", exportedTelemetry, expect.stringContaining("Webhooks.receive")],
			["private data seen in", secretsSeenIn, []],
		]);
	},
);

const failures: ReadonlyArray<readonly [Delivery, string, string]> = [
	["a delivery whose mapping copies its title into an error", "PayloadRejected", "503 Service Unavailable"],
	["a delivery whose mapping fails with its title", "Unknown", "503 Service Unavailable"],
	["a delivery whose mapping dies with its title", "Unknown", "500 Internal Server Error"],
	["an issue delivery whose number is a string", "", "400 Bad Request"],
];

for (const [delivery, tag, expectedAnswer] of failures) {
	inbox.it(
		`${delivery} keeps payload content out of logs and OTLP exports`,
		[telemetryCollector],
		function* ({ answer, deliver, exportedTelemetry, secretsSeenIn, storedData }) {
			yield* deliver(delivery);

			const exported = yield* exportedTelemetry();
			expect(exported).toContain("Webhooks.receive");
			if (tag !== "") {
				expect(exported).toContain(tag);
			}
			yield* outcomes([
				["answer", answer, expectedAnswer],
				["stored data", storedData, { jobs: [], receipts: [] }],
				["private data seen in", secretsSeenIn, []],
			]);
		},
	);
}
