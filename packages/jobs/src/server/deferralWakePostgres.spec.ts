import { Schema } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue } from "#definition.ts";
import { database } from "#test/postgres/database.ts";
import { runningWithClockOffset } from "#test/postgres/runningWithClockOffset.ts";
import { storedTogether } from "#test/postgres/traits.ts";
import { worker } from "#test/workers.ts";

const Deferred = defineQueue({
	name: "deferred-wake",
	queue: { notify: true },
	schema: Schema.Struct({}),
	worker: { notifyPollingIntervalSeconds: 60, pollingIntervalSeconds: 60 },
});

for (const offset of [0, 60_000, -60_000]) {
	// The provider's due time stays one second ahead of PostgreSQL despite the runtime clock skew.
	const until = { afterMillis: 1000 - offset };
	database.it(
		`a deferred job runs at its due time before the notify polling backstop with the runtime clock offset by ${offset} ms`,
		[
			storedTogether(Deferred, [{ as: "job", data: {} }]),
			runningWithClockOffset("app", [worker(Deferred, { defers: "Provider quota", until }, "notes its job in the application log")], offset, {
				schedule: false,
				supervise: false,
				useListenNotify: true,
			}),
		],
		function* ({ applicationLoggedJob, untilJob, wakes }) {
			yield* untilJob("job", "completed");

			yield* outcomes([
				["application logged the resumed job", () => applicationLoggedJob("job"), true],
				["wakes", () => wakes("app"), ["idle worker"]],
			]);
		},
	);
}
