import { expect } from "@effect/vitest";
import { Deferred, Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";
import { Fleet } from "#fleet.ts";
import { prepareWork, withEngine } from "#test/engine.ts";
import { parkStalled } from "#test/parkStalled.ts";
import { postgresTests } from "#test/postgres.ts";
import { stalledProvider } from "#test/stalledProvider.ts";

for (const fault of ["unavailable", "hanging", "mismatch"] as const) {
	postgresTests("test")(`stalled release retains evidence when the provider is ${fault}`, function* () {
		let now = 0;
		const { archiving, decorateTransport, fail, interrupting, observing } = yield* stalledProvider(fault);
		yield* withEngine(
			{
				decorateTransport,
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
					expect(stalled.value.decision?.code).toBe("session-stalled");
					fail();
					const decisionId = stalled.value.decision?.id ?? "missing";
					const responseId = fixture.respond(decisionId, "release");
					const resolving = yield* fleet.resolve("one", decisionId, responseId).pipe(Effect.forkChild);
					if (fault === "hanging") {
						yield* Deferred.await(interrupting);
						expect((yield* fleet.get("one")).value.attempts[0]?.abandoned).toBeDefined();
						yield* TestClock.adjust("5 seconds");
						yield* Deferred.await(observing);
						yield* TestClock.adjust("5 seconds");
						yield* Deferred.await(archiving);
						yield* TestClock.adjust("5 seconds");
					}
					const released = yield* Fiber.join(resolving);
					expect(released.value.step).toBe("released");
					expect(released.value.attempts[0]?.abandoned).toMatchObject({
						interruptError: expect.any(String),
						observation: { execution: "running", output: stalled.value.attempts[0]?.output },
						observationError: expect.any(String),
					});
					expect(released.value.attempts[0]?.output).toBeUndefined();
				}),
		);
	});
}
