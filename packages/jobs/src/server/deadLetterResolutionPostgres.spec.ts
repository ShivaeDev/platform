import { Schema } from "effect";
import { expect } from "vitest";
import { defineQueue } from "#definition.ts";
import { database } from "#test/postgres/database.ts";
import { enqueuedUntil, running } from "#test/postgres/traits.ts";
import { worker } from "#test/workers.ts";

for (const partition of [false, true]) {
	const Mail = defineQueue({
		name: "mail-dlq",
		queue: { partition, retryLimit: 0 },
		schema: Schema.Struct({ id: Schema.Number }),
	});

	database.it(
		`a ${partition ? "partitioned" : "shared"} queue keeps dead letters until a retry succeeds, then lists only the unretried job`,
		[
			running("app", [worker(Mail, { fails: "Delivery rejected" }, { waitsFor: "delivery" })], { schema: "mail_jobs" }),
			enqueuedUntil(Mail, { id: 42 }, { as: "mail 42" }, "failed"),
			enqueuedUntil(Mail, { id: 7 }, { as: "mail 7" }, "failed"),
		],
		function* ({ listed, listedNames, open, retry, untilJob, untilWaiting }) {
			expect(yield* listed("app", "dead-lettered", Mail)).toMatchObject({
				jobs: [
					expect.objectContaining({ job: "copy of mail 7", queue: "mail-dlq-dlq", sourceQueue: "mail-dlq" }),
					expect.objectContaining({ job: "copy of mail 42", queue: "mail-dlq-dlq", sourceQueue: "mail-dlq" }),
				],
			});

			yield* retry("app", "mail 42");
			yield* untilWaiting("delivery");

			expect(yield* listedNames("app", "dead-lettered", Mail)).toEqual(["copy of mail 7", "copy of mail 42"]);

			yield* open("delivery");
			yield* untilJob("mail 42", "completed");

			expect(yield* listedNames("app", "dead-lettered", Mail)).toEqual(["copy of mail 7"]);
		},
	);
}

const Rejected = defineQueue({ name: "rejected", queue: { retryLimit: 0 }, schema: Schema.Struct({}) });

database.it(
	"a retry that fails stays dead-lettered, and a later successful retry clears every copy of that job",
	[
		running("app", [worker(Rejected, { fails: "First rejection" }, { fails: "Rejected again" }, "succeeds")]),
		enqueuedUntil(Rejected, {}, { as: "mail 42" }, "failed"),
	],
	function* ({ listedNames, retry, untilJob }) {
		expect(yield* listedNames("app", "dead-lettered", Rejected)).toEqual(["copy of mail 42"]);

		yield* retry("app", "mail 42");
		yield* untilJob("mail 42", "failed");

		expect(yield* listedNames("app", "dead-lettered", Rejected)).toEqual(["copy of mail 42", "copy of mail 42"]);

		yield* retry("app", "mail 42");
		yield* untilJob("mail 42", "completed");

		expect(yield* listedNames("app", "dead-lettered", Rejected)).toEqual([]);
	},
);
