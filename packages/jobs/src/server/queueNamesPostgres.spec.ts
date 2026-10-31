import { Effect, Schema } from "effect";
import { expect } from "vitest";
import { defineQueue, defineSchedule } from "#definition.ts";
import { database } from "#test/postgres/database.ts";
import { running } from "#test/postgres/traits.ts";
import { cleanupSchedule, emailQueue, queueNames } from "#test/queueNames.ts";
import { scheduled, worker } from "#test/workers.ts";

const Emails = defineQueue({ ...emailQueue, worker: { pollingIntervalSeconds: 1 } });
const Cleanup = defineSchedule({ ...cleanupSchedule, cron: "17 3 * * *" });
const Unexpected = defineQueue({ name: "unexpected", schema: Schema.Struct({}) });

database.it(
	"a worker uses the browser's declared queue name to handle an email",
	[running("app", [worker(Emails, "succeeds")], { queueNames: [emailQueue.name] })],
	function* ({ enqueue, untilFinished, handled }) {
		yield* enqueue("app", Emails, { userId: 42 }, { as: "welcome" });
		yield* untilFinished(Emails, 1);

		expect(yield* handled(Emails)).toEqual([{ userId: 42 }]);
	},
);

database.it(
	"health exposes the browser's names for producer queues and schedules regardless of declaration order",
	[running("app", [scheduled(Cleanup, "succeeds"), Emails], { queueNames })],
	function* ({ ask, answered }) {
		yield* ask("app", "report registered names", (jobs) => jobs.health().pipe(Effect.map((health) => health.jobs.map(({ name }) => name))));

		expect(yield* answered()).toEqual([cleanupSchedule.name, emailQueue.name]);
	},
);

for (const [title, names, jobs, missing, unexpected] of [
	["an undeclared server queue", [emailQueue.name], [Emails, Unexpected], [], ["unexpected"]],
	["a declared name without a server queue", queueNames, [Emails], [cleanupSchedule.name], []],
	["a renamed queue", [emailQueue.name], [Unexpected], [emailQueue.name], ["unexpected"]],
	["a server queue under an empty declaration", [], [Emails], [], [emailQueue.name]],
] as const) {
	database.it(`${title} fails boot with the missing and unexpected names`, [], function* ({ start, startup }) {
		yield* start("app", jobs, { queueNames: names });

		expect(yield* startup("app")).toBe(`queue declaration mismatch: missing [${missing.join(", ")}], unexpected [${unexpected.join(", ")}]`);
	});
}

database.it("an empty declaration permits an empty runtime", [], function* ({ start, startup }) {
	yield* start("app", [], { queueNames: [] });

	expect(yield* startup("app")).toBe("started");
});
