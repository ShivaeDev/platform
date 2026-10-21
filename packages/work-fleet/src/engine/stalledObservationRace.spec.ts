import { expect } from "@effect/vitest";
import { Deferred, Effect, Fiber } from "effect";
import { Fleet } from "#fleet.ts";
import { prepareWork, withEngine } from "#test/engine.ts";
import { parkStalled } from "#test/parkStalled.ts";
import { postgresTests } from "#test/postgres.ts";

postgresTests("test", "isolated")("an observation already in flight cannot restore a released stalled turn", function* () {
	let now = 0;
	let holdNext = false;
	const entered = yield* Deferred.make<void>();
	const resume = yield* Deferred.make<void>();
	yield* withEngine(
		{
			decorateTransport: (transport) => ({
				...transport,
				observe: (receipt) =>
					Effect.gen(function* () {
						if (holdNext) {
							holdNext = false;
							yield* Deferred.succeed(entered, undefined);
							yield* Deferred.await(resume);
							return { execution: "completed" as const, output: "Late output", provisioning: "ready" as const, receipt };
						}
						const observation = yield* transport.observe(receipt);
						return { ...observation, progress: [{ id: "unchanged" }] };
					}),
			}),
			now: () => now,
		},
		(fixture) =>
			Effect.gen(function* () {
				const fleet = yield* Fleet;
				yield* prepareWork("one");
				yield* fleet.dispatch("one");
				const stalled = yield* parkStalled(() => {
					now += 31 * 60_000;
				});
				holdNext = true;
				const observing = yield* fleet.reconcile("one").pipe(Effect.result, Effect.forkChild);
				yield* Deferred.await(entered);
				const decisionId = stalled.value.decision?.id ?? "missing";
				const released = yield* fleet.resolve("one", decisionId, fixture.respond(decisionId, "release"));
				expect(released.value.step).toBe("released");
				yield* Deferred.succeed(resume, undefined);
				yield* Fiber.join(observing);
				const final = yield* fixture.restart(fleet.get("one"));
				expect(final.value).toEqual(released.value);
				expect(final.value.attempts[0]?.output).toBeUndefined();
				expect(final.value.result).toBeUndefined();
			}),
	);
});
