import { expect } from "@effect/vitest";
import { Clock, Effect } from "effect";
import { TestClock } from "effect/testing";
import { Fleet } from "#fleet.ts";
import { SessionTransport } from "#session/service.ts";
import { codexConfiguration } from "#test/codex.ts";
import { prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";
import { stalledCodex } from "#test/stalledCodex.ts";

for (const change of ["count", "status"] as const) {
	postgresTests("test", "isolated")(`changing item ${change} resets the timer without steering`, function* () {
		const server = yield* stalledCodex();
		const clock = yield* Clock.Clock;
		yield* Effect.gen(function* () {
			const transport = yield* SessionTransport;
			yield* withEngine({ decorateTransport: () => transport, now: () => clock.currentTimeMillisUnsafe() }, () =>
				Effect.gen(function* () {
					const fleet = yield* Fleet;
					yield* prepareWork("one");
					yield* fleet.dispatch("one");
					yield* fleet.reconcile("one");
					for (let index = 0; index < 5; index += 1) {
						yield* TestClock.adjust("20 minutes");
						if (change === "count") {
							server.addItem();
						} else {
							server.changeStatus();
						}
						const current = yield* fleet.reconcile("one");
						expect(current.value.attempts[0]?.progress?.at).toBe(clock.currentTimeMillisUnsafe());
					}
					expect(server.requests.filter((request) => ["turn/steer", "turn/interrupt"].includes(request.method))).toEqual([]);
				}),
			);
		}).pipe(Effect.provide(codexConfiguration(server.endpoint)));
	});
}
