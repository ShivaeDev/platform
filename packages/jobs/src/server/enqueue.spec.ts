import { Schema } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue } from "#definition.ts";
import { running, runtime } from "#test/runtime/kit.ts";

const Emails = defineQueue({ name: "emails", schema: Schema.Struct({ id: Schema.NumberFromString.check(Schema.isFinite()) }) });

runtime.it("enqueueing sends the encoded payload and answers its job id", [running("app", [Emails])], function* ({ answered, ask, sent }) {
	yield* ask("app", "enqueue email 42", (jobs) => jobs.enqueue(Emails, { id: 42 }));

	yield* outcomes({
		"answer": [answered(), "emails-job-1"],
		"sent": [sent(), [{ data: { id: "42" }, name: "emails", options: undefined }]],
	});
});

runtime.it(
	"a payload that cannot encode fails the enqueue with an encode error and sends nothing",
	[running("app", [Emails])],
	function* ({ answered, ask, sent }) {
		yield* ask("app", "enqueue an email without a finite id", (jobs) => jobs.enqueue(Emails, { id: Number.NaN }));

		yield* outcomes({
			"answer": [answered(), 'encode emails payload failed with Expected a finite number\n  at ["id"]'],
			"sent": [sent(), []],
		});
	},
);
