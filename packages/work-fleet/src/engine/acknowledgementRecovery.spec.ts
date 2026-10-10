import { Deferred, Effect, Fiber } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { cycle } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import { deniedDecision } from "#test/deniedDecision.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

const test = it.effect.skipIf(storageDatabaseUrl === undefined);

test("applied action persists across acknowledgement failure and repeated resolve after restart repairs only acknowledgement", () =>
	withEngine({ acknowledgeFailure: true, denyDelivery: true }, (fixture) =>
		Effect.gen(function* () {
			const decision = yield* deniedDecision(fixture);
			const responseId = fixture.respond(decision.id, "release");
			const fleet = yield* Fleet;
			const applied = yield* fleet.resolve("one", decision.id, responseId);
			expect(applied.value.stage).toBe("released");
			expect(applied.value.responses).toHaveLength(1);
			expect(applied.value.responses?.[0]?.boardAcknowledged).toBeUndefined();
			expect(applied.value.blocker).toContain("Board request acknowledgement pending");
			expect(fixture.acknowledgements).toHaveLength(0);
			const repaired = yield* fixture.restart(Fleet.pipe(Effect.flatMap((resumed) => resumed.resolve("one", decision.id, responseId))));
			expect(repaired.value.stage).toBe("released");
			expect(repaired.value.responses).toHaveLength(1);
			expect(repaired.value.responses?.[0]?.boardAcknowledged).toBe(true);
			expect(repaired.value.blocker).toBeUndefined();
			expect((yield* fleet.resolve("one", decision.id, responseId)).version).toBe(repaired.version);
			expect(fixture.acknowledgementAttempts).toHaveLength(2);
			expect(fixture.acknowledgements[0]).toMatchObject({ disposition: "applied", responseId });
			expect(fixture.launched).toHaveLength(2);
		}),
	));

test("scheduler repairs a terminal released request acknowledgement after restart without launching work", () =>
	withEngine({ acknowledgeFailure: true, denyDelivery: true }, (fixture) =>
		Effect.gen(function* () {
			const decision = yield* deniedDecision(fixture);
			const fleet = yield* Fleet;
			yield* fleet.resolve("one", decision.id, fixture.respond(decision.id, "release"));
			yield* fixture.restart(cycle);
			const repaired = yield* fleet.get("one");
			expect(repaired.value.stage).toBe("released");
			expect(repaired.value.responses?.[0]?.boardAcknowledged).toBe(true);
			expect(fixture.acknowledgements).toHaveLength(1);
			expect(fixture.launched).toHaveLength(2);
		}),
	));

test("renewal commits history before superseding its Board request and resumes acknowledgement after restart", () =>
	withEngine({ acknowledgeFailure: true, denyDelivery: true }, (fixture) =>
		Effect.gen(function* () {
			const decision = yield* deniedDecision(fixture);
			fixture.editWork("one", "board-one-renewed");
			fixture.approveWork("one", "board-one-renewed");
			const renewed = yield* prepareWork("one");
			expect(renewed.value.stage).toBe("prepared");
			expect(renewed.value.history?.[0]?.decision?.id).toBe(decision.id);
			expect(renewed.value.history?.[0]?.decisionAcknowledged).toBeUndefined();
			expect(renewed.value.blocker).toContain("Board request acknowledgement pending");
			const repaired = yield* fixture.restart(Fleet.pipe(Effect.flatMap((fleet) => fleet.reconcile("one"))));
			expect(repaired.value.stage).toBe("prepared");
			expect(repaired.value.history?.[0]?.decisionAcknowledged).toBe(true);
			expect(fixture.acknowledgements[0]).toMatchObject({ decision: decision.published, disposition: "superseded" });
			expect(fixture.launched).toHaveLength(2);
		}),
	));

for (const type of ["clarify", "not_now"] as const) {
	test(`${type} remains open and repeated response processing never duplicates action or Board acknowledgement`, () =>
		withEngine({ denyDelivery: true }, (fixture) =>
			Effect.gen(function* () {
				const decision = yield* deniedDecision(fixture);
				const responseId = fixture.respond(decision.id, "retry", type);
				const fleet = yield* Fleet;
				const first = yield* fleet.resolve("one", decision.id, responseId);
				const repeated = yield* fixture.restart(Fleet.pipe(Effect.flatMap((resumed) => resumed.resolve("one", decision.id, responseId))));
				expect(repeated.version).toBe(first.version);
				expect(repeated.value.stage).toBe("needs-human");
				expect(repeated.value.responses).toHaveLength(1);
				expect(repeated.value.decision?.id).toBe(decision.id);
				expect(repeated.value.responses?.[0]?.action).toBeUndefined();
				expect(fixture.acknowledgementAttempts).toHaveLength(0);
				expect(fixture.launched).toHaveLength(2);
			}),
		));
}

test("decision acknowledgement remains usable while unrelated review waits", function* () {
	const entered = yield* Deferred.make<void>();
	const release = yield* Deferred.make<void>();
	const reviewGate = Deferred.succeed(entered, undefined).pipe(Effect.andThen(Deferred.await(release)));
	yield* withEngine({ reviewGate }, (fixture) =>
		Effect.gen(function* () {
			yield* prepareWork("one");
			yield* prepareWork("two");
			const fleet = yield* Fleet;
			yield* fleet.dispatch("one");
			finishWorkers(fixture);
			const reviewing = yield* fleet.reconcile("one").pipe(Effect.forkChild);
			yield* Deferred.await(entered);
			yield* fixture.foreign("native-owner-two", ["src/two.ts"]);
			const pending = yield* fleet.dispatch("two");
			const id = pending.value.decision?.id ?? "missing";
			const applied = yield* fleet.resolve("two", id, fixture.respond(id, "release"));
			expect(applied.value.stage).toBe("released");
			expect(applied.value.responses?.[0]?.boardAcknowledged).toBe(true);
			expect((yield* fleet.get("one")).value.stage).toBe("reviewing");
			yield* Deferred.succeed(release, undefined);
			expect((yield* Fiber.join(reviewing)).value.stage).toBe("completed");
		}),
	);
});
