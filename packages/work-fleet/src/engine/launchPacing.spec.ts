import { describe, expect } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { executing } from "#model.ts";
import { engineConfiguration } from "#test/engineConfiguration.ts";
import { isolatedEngine } from "#test/engineStory.ts";
import { launchAcknowledgement } from "#test/launchAcknowledgement.ts";

describe("Fleet launch acknowledgement pacing", () => {
	const slowLaunchAcknowledgement = engineConfiguration("the slow launch acknowledgement arrives after its pass", launchAcknowledgement("slow"));
	isolatedEngine.it(
		"a slow thread acknowledgement is persisted after the pass, without concurrent recovery",
		[slowLaunchAcknowledgement],
		function* ({
			operationReceipt,
			launches,
			publishedDecisions,
			waitForTimingGate,
			releaseTimingGate,
			waitForStoredRecord,
			prepareWork,
			fleet,
			schedule,
		}) {
			yield* prepareWork("one");
			yield* prepareWork("two");

			expect(
				(yield* Effect.gen(function* () {
					const pass = yield* schedule().pipe(Effect.forkChild);
					yield* waitForTimingGate();
					yield* TestClock.adjust("1 second");
					return yield* Fiber.join(pass);
				})).dispatched,
			).toHaveLength(2);
			yield* schedule();
			expect(publishedDecisions()).toEqual([]);
			yield* releaseTimingGate("acknowledgement");
			yield* waitForStoredRecord("one", (record) => record.attempts[0]?.receipt !== undefined);
			expect((yield* fleet.get("one")).value.attempts[0]?.receipt).toEqual(operationReceipt("operation-1"));
			expect(launches()).toEqual(["operation-1", "operation-2"]);
		},
	);
	for (const acknowledgement of ["session", "turn"] as const) {
		const lostLaunchAcknowledgement = engineConfiguration(
			`the ${acknowledgement} launch acknowledgement arrives after its pass`,
			launchAcknowledgement(acknowledgement),
		);
		isolatedEngine.it(
			`a lost ${acknowledgement} acknowledgement allows the next launch in the same pass`,
			[lostLaunchAcknowledgement],
			function* ({ operationReceipt, launches, publishedDecisions, waitForTimingGate, prepareWork, restart, fleet, schedule }) {
				yield* prepareWork("one");
				yield* prepareWork("two");

				expect(
					(yield* Effect.gen(function* () {
						const pass = yield* schedule().pipe(Effect.forkChild);
						yield* waitForTimingGate();
						yield* TestClock.adjust("1 second");
						return yield* Fiber.join(pass);
					})).dispatched,
				).toHaveLength(2);
				const pending = (yield* fleet.get("one")).value;
				expect(pending.attempts[0]).toMatchObject({ operationId: "operation-1", status: "submitting" });
				expect(pending.attempts[0]?.receipt).toBeUndefined();
				expect(executing(pending)).toBe(true);
				expect((yield* fleet.get("two")).value.attempts[0]?.receipt).toBeDefined();
				expect(publishedDecisions()).toEqual([]);
				yield* restart();
				yield* schedule();
				const recovered = (yield* fleet.get("one")).value;
				if (acknowledgement === "turn") {
					expect(recovered.attempts[0]?.receipt).toEqual(operationReceipt("operation-1"));
					expect(recovered.attempts[0]?.status).toBe("running");
				}
				expect(recovered.attempts).toHaveLength(1);
				expect(executing(recovered)).toBe(true);
				expect(launches()).toEqual(["operation-1", "operation-2"]);
			},
		);
	}
	const capacityLaunchAcknowledgement = engineConfiguration(
		"the capacity launch acknowledgement arrives after its pass",
		launchAcknowledgement("capacity"),
	);
	isolatedEngine.it(
		"an explicit capacity rejection after a lost acknowledgement stops the rest of the pass",
		[capacityLaunchAcknowledgement],
		function* ({ setDependencies, launches, waitForTimingGate, prepareWork, fleet, schedule }) {
			setDependencies("dependent", []);
			for (const id of ["one", "two", "dependent"]) {
				yield* prepareWork(id);
			}

			expect(
				(yield* Effect.gen(function* () {
					const pass = yield* schedule().pipe(Effect.forkChild);
					yield* waitForTimingGate();
					yield* TestClock.adjust("1 second");
					return yield* Fiber.join(pass);
				})).dispatched,
			).toHaveLength(2);
			expect((yield* fleet.get("two")).value.launchRetry).toBeDefined();
			expect((yield* fleet.get("dependent")).value.attempts).toEqual([]);
			expect(launches()).toEqual(["operation-1", "operation-2"]);
		},
	);
	const backgroundLaunchAcknowledgement = engineConfiguration(
		"the background launch acknowledgement arrives after its pass",
		launchAcknowledgement("background"),
	);
	isolatedEngine.it(
		"a capacity rejection from a background launch stops later dispatch",
		[backgroundLaunchAcknowledgement],
		function* ({ setDependencies, launches, waitForTimingGate, waitForStoredRecord, prepareWork, fleet, schedule }) {
			setDependencies("dependent", []);
			for (const id of ["one", "two", "dependent"]) {
				yield* prepareWork(id);
			}

			const pass = yield* schedule().pipe(Effect.forkChild);
			yield* waitForTimingGate("sessionReached");
			yield* TestClock.adjust("1 second");
			yield* waitForTimingGate("turnReached");
			yield* TestClock.adjust("500 millis");
			yield* waitForStoredRecord("one", (record) => record.launchRetry !== undefined);
			yield* TestClock.adjust("500 millis");
			expect((yield* Fiber.join(pass)).dispatched).toHaveLength(2);
			expect((yield* fleet.get("dependent")).value.attempts).toEqual([]);
			expect(launches()).toEqual(["operation-1", "operation-2"]);
		},
	);
	isolatedEngine.it(
		"a human retry reuses the thread whose first turn was rejected",
		[],
		function* ({ rejectNextTurn, launches, prepareWork, respond, restart, fleet, schedule }) {
			yield* prepareWork("one");
			rejectNextTurn();
			const rejected = (yield* fleet.dispatch("one")).value;
			const decisionId = rejected.decision?.id ?? "missing";
			yield* fleet.resolve("one", decisionId, respond(decisionId, "retry"));
			yield* restart();
			yield* schedule();
			const accepted = (yield* fleet.get("one")).value;
			expect(accepted.attempts).toHaveLength(2);
			expect(accepted.attempts.at(-1)?.receipt).toEqual({ sessionId: rejected.attempts[0]?.sessionId, turnId: "turn-operation-2" });
			expect(launches()).toEqual(["operation-1"]);
		},
	);
});
