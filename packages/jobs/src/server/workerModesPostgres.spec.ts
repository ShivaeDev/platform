import { Schema } from "effect";
import type { WorkOptions } from "pg-boss";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineSchedule } from "#defineSchedule.ts";
import { defineQueue } from "#definition.ts";
import { database } from "#test/postgres/database.ts";
import { running, storedTogether } from "#test/postgres/traits.ts";
import { scheduled, worker, workerBy } from "#test/workers.ts";

const unsupported: readonly { readonly modes: string; readonly options: WorkOptions }[] = [
	{ modes: "perJobResults", options: { perJobResults: true } },
	{ modes: "transactional", options: { transactional: true } },
	{ modes: "perJobResults, transactional", options: { perJobResults: true, transactional: true } },
];

for (const { modes, options } of unsupported) {
	const Queue = defineQueue({ name: "unsupported-queue", schema: Schema.Struct({}), worker: options });
	const Schedule = defineSchedule({ cron: "17 3 * * *", name: "unsupported-schedule", worker: options });
	for (const registration of [
		{ definition: Queue, kind: "queue", worker: worker(Queue, "succeeds") },
		{ definition: Schedule, kind: "schedule", worker: scheduled(Schedule, "succeeds") },
	]) {
		database.it(`a ${registration.kind} worker refuses ${modes} at startup`, [], function* ({ handled, start, startup }) {
			yield* start("app", [registration.worker]);

			yield* outcomes([
				[
					"startup",
					() => startup("app"),
					`register ${registration.definition.name} failed with Unsupported worker callback modes: ${modes}. Omit these options or set them to false.`,
				],
				["handled jobs", () => handled(registration.definition), []],
			]);
		});
	}
}

const supported: readonly { readonly mode: string; readonly options: WorkOptions }[] = [
	{ mode: "omitted callback flags", options: {} },
	{ mode: "explicitly false callback flags", options: { perJobResults: false, transactional: false } },
];

for (const { mode, options } of supported) {
	const Queue = defineQueue({
		name: "supported-queue",
		queue: { retryLimit: 0 },
		schema: Schema.Struct({ id: Schema.Number }),
		worker: options,
	});
	database.it(
		`a queue worker with ${mode} settles successful and failed jobs independently`,
		[
			storedTogether(Queue, [
				{ as: "success", data: { id: 1 } },
				{ as: "failure", data: { id: 2 } },
			]),
		],
		function* ({ handled, start, storedStates, untilSettled }) {
			yield* start("app", [workerBy(Queue, ({ id }) => (id === 2 ? { fails: "Rejected" } : "succeeds"))]);
			yield* untilSettled(Queue, 2);

			yield* outcomes([
				["handled payloads", () => handled(Queue), expect.arrayContaining([{ id: 1 }, { id: 2 }])],
				["stored states", () => storedStates(Queue.name), { failure: "failed", success: "completed" }],
			]);
		},
	);

	const Schedule = defineSchedule({ cron: "17 3 * * *", name: "supported-schedule", worker: options });
	database.it(
		`a scheduled worker with ${mode} handles a delivered job`,
		[running("app", [scheduled(Schedule, "succeeds")])],
		function* ({ adminSends, handled, storedStates, untilIdle }) {
			yield* adminSends(Schedule.name, null, { as: "scheduled job" });
			yield* untilIdle("app");

			yield* outcomes([
				["handled payloads", () => handled(Schedule), [null]],
				["stored states", () => storedStates(Schedule.name), { "scheduled job": "completed" }],
			]);
		},
	);
}
