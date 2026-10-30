import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { type JobsView, jobsStory, mailFails, mounted, signedInAs, syncWaits } from "#test/jobsStory.ts";

const admin = signedInAs("admin");

jobsStory.it(
	"an operator with only jobs.read is forbidden to retry failed mail 42, which stays failed",
	[signedInAs("operator"), mailFails(42)],
	function* ({ deliveries, lastAnswerOnTheWire, retry, stateOf, workersFinish }) {
		yield* retry("mail 42");

		expect(yield* lastAnswerOnTheWire()).toContain('"_tag":"Forbidden"');

		yield* workersFinish();

		yield* outcomes({
			deliveries: [deliveries(), ["mail 42"]],
			"mail 42's state": [stateOf("mail 42"), "failed"],
		});
	},
);

jobsStory.it(
	"an admin with jobs.retry retries failed mail 42, delivering it a second time and completing it",
	[admin, mailFails(42)],
	function* ({ deliveries, retry, stateOf, workersFinish }) {
		expect(yield* deliveries()).toEqual(["mail 42"]);

		yield* retry("mail 42");
		yield* workersFinish();

		yield* outcomes({
			deliveries: [deliveries(), ["mail 42", "mail 42"]],
			"mail 42's state": [stateOf("mail 42"), "completed"],
		});
	},
);

for (const [view, before, after, change] of [
	["failed mail jobs", ["mail 42"], [], "no longer listing mail 42"],
	["mail counts", "1 failed", "0 failed", "counting no failed mail job"],
	["mail 42's detail", "failed", "not failed", "no longer showing mail 42 failed"],
	["dead-lettered mail jobs", ["the dead-letter copy of mail 42"], ["the dead-letter copy of mail 42"], "still listing mail 42's dead-letter copy"],
	["health", ["mail", "scheduled", "sync"], ["mail", "scheduled", "sync"], "still listing the page's three queues"],
] as const satisfies readonly (readonly [JobsView, unknown, unknown, string])[]) {
	jobsStory.it(
		`retrying mail 42 makes the mounted ${view} view answer again, ${change}`,
		[admin, mailFails(42), mounted(view)],
		function* ({ nextAnswer, retry }) {
			expect(yield* nextAnswer(view)).toEqual(before);

			yield* retry("mail 42");

			expect(yield* nextAnswer(view)).toEqual(after);
		},
	);
}

for (const [name, queue, refusal, setup] of [
	["the dead-letter copy of mail 42", "mail-dlq", "mail-dlq is not a registered queue", []],
	["the dead-letter copy of mail 42", "mail", "the dead-letter copy of mail 42 is not a failed mail job", []],
	["an unknown job", "mail", "an unknown job is not a failed mail job", []],
	["mail 42", "private", "private is not a registered queue", []],
	["the waiting sync job", "sync", "the waiting sync job is not a failed sync job", [syncWaits]],
] as const) {
	jobsStory.it(`an admin's retry of ${name} in ${queue} is refused: ${refusal}`, [admin, mailFails(42), ...setup], function* ({ retry }) {
		expect(yield* retry(name, queue)).toBe(refusal);
	});
}
