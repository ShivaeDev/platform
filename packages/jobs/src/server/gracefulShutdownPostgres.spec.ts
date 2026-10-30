import { Schema } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue } from "#definition.ts";
import { database } from "#test/postgres/database.ts";
import { enqueuedEarlier, running, waiting } from "#test/postgres/traits.ts";
import { worker } from "#test/workers.ts";

const Held = defineQueue({ name: "graceful-shutdown", schema: Schema.Struct({}), worker: { pollingIntervalSeconds: 0.5 } });

for (const client of ["its own", "a shared"] as const) {
	const clientCacheKey = Symbol(`graceful shutdown on ${client} client`);
	database.it(
		`a runtime on ${client} client that finalizes in parallel lets its running handler finish before it stops`,
		[
			enqueuedEarlier(Held, {}, { as: "held job" }),
			...(client === "a shared" ? [running("producer", [Held], { clientCacheKey })] : []),
			running("app", [worker(Held, { waitsFor: "held" })], { clientCacheKey, finalizesInParallel: true }),
			waiting("held", "the held job's handler is running"),
		],
		function* ({ interruptions, job, open, shutdown, stopInBackground, untilPgBossStopsWorking, untilStopped }) {
			yield* stopInBackground("app");
			yield* untilPgBossStopsWorking();

			yield* outcomes({
				"held job": [job("held job"), expect.objectContaining({ state: "active" })],
				"shutdown": [shutdown("app"), "still stopping"],
			});

			yield* open("held");
			yield* untilStopped("app");

			yield* outcomes({
				"held job": [job("held job"), expect.objectContaining({ state: "completed" })],
				"interrupted handlers": [interruptions(Held), []],
				"shutdown": [shutdown("app"), "stopped"],
			});
		},
	);
}
