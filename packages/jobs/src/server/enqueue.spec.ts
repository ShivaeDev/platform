import { Schema } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue } from "#server/definition.ts";
import { CodecQueue } from "#test/CodecQueue.ts";
import { callerHasAnotherClient, running, runtime } from "#test/runtime/kit.ts";

const Emails = defineQueue({ name: "emails", schema: Schema.Struct({ id: Schema.NumberFromString.check(Schema.isFinite()) }) });

runtime.it("enqueueing sends the encoded payload and answers its job id", [running("app", [Emails])], function* ({ answered, ask, sent }) {
	yield* ask("app", "enqueue email 42", (jobs) => jobs.enqueue(Emails, { id: 42 }));

	yield* outcomes([
		["answer", () => answered(), "emails-job-1"],
		["sent", () => sent(), [{ data: { id: "42" }, name: "emails", options: undefined }]],
	]);
});

runtime.it(
	"a payload that cannot encode fails the enqueue with an encode error and sends nothing",
	[running("app", [Emails])],
	function* ({ answered, ask, sent }) {
		yield* ask("app", "enqueue an email without a finite id", (jobs) => jobs.enqueue(Emails, { id: Number.NaN }));

		yield* outcomes([
			["answer", () => answered(), 'encode emails payload failed with Expected a finite number\n  at ["id"]'],
			["sent", () => sent(), []],
		]);
	},
);

runtime.it(
	"enqueue uses the client bound by its Layer when the caller provides another client",
	[callerHasAnotherClient, running("app", [Emails])],
	function* ({ ask, sent }) {
		yield* ask("app", "enqueue email 42", (jobs) => jobs.enqueue(Emails, { id: 42 }));

		expect(yield* sent()).toEqual([{ data: { id: "42" }, name: "emails", options: undefined }]);
	},
);

runtime.it(
	"payload encoding uses the caller's services instead of the Layer's services",
	[running("app", [CodecQueue])],
	function* ({ applicationLog, enqueueUsingCallerServices }) {
		yield* enqueueUsingCallerServices("app");

		expect(yield* applicationLog()).toEqual(["caller encoded 42"]);
	},
);
