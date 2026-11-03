import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { delivered, inbox } from "#test/story.ts";

const DELIVERY_ID = "40bbf3db-0691-4dd1-93b3-9b0c778af4f4";

inbox.it(
	"a signed delivery maps its decoded payload and normalized delivery id, source and event into work under the chosen job id",
	[],
	function* ({ answer, deliver, deliveryJobs }) {
		yield* deliver("the same delivery through the mirror source");

		yield* outcomes([
			["answer", () => answer(), "202 Accepted: queued"],
			[
				"worker received",
				() => deliveryJobs(),
				[{ jobId: DELIVERY_ID, payload: { delivery: { event: "delivery_issues", id: DELIVERY_ID, source: "mirror" }, number: 42 } }],
			],
		]);
	},
);

inbox.it(
	"a redelivery through another source maps to the same job id and creates no second job",
	[delivered("a signed delivery mapped with metadata")],
	function* ({ answer, deliver, deliveryJobs, storedReceipts }) {
		const original = yield* deliveryJobs();
		expect(original).toEqual([
			{ jobId: DELIVERY_ID, payload: { delivery: { event: "delivery_issues", id: DELIVERY_ID, source: "github" }, number: 42 } },
		]);

		yield* deliver("the same delivery through the mirror source");

		yield* outcomes([
			["answer", () => answer(), "202 Accepted: queued"],
			["worker received", () => deliveryJobs(), original],
			[
				"stored receipts",
				() => storedReceipts(),
				[
					{ delivery: DELIVERY_ID, event: "delivery_issues", jobs: ["webhook-delivery for issue 42"], outcome: "queued", source: "github" },
					{ delivery: DELIVERY_ID, event: "delivery_issues", jobs: [], outcome: "queued", source: "mirror" },
				],
			],
		]);
	},
);
