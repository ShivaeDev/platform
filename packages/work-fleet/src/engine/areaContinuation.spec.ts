import { Effect } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { Fleet } from "#fleet.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

const test = it.effect.skipIf(storageDatabaseUrl === undefined);

test("continuing completed work reacquires areas even when the old attempts move to history", () =>
	withEngine({ noChange: true }, (fixture) =>
		Effect.gen(function* () {
			fixture.areas("one", ["fleet/host"]);
			fixture.areas("two", ["fleet/host"]);
			yield* prepareWork("one");
			yield* prepareWork("two");
			const fleet = yield* Fleet;
			yield* fleet.dispatch("one");
			finishWorkers(fixture);
			yield* fleet.reconcile("one");
			yield* fleet.dispatch("two");
			expect(yield* fleet.continue("one", "Check the follow-up").pipe(Effect.flip)).toMatchObject({
				message: "waiting for area fleet/host held by two",
			});
			expect((yield* fleet.get("one")).value.stage).toBe("completed");
			expect(fixture.operations.size).toBe(3);
			finishWorkers(fixture);
			yield* fleet.reconcile("two");
			const continued = yield* fleet.continue("one", "Check the follow-up");
			expect(continued.value.stage).toBe("executing");
			expect(continued.value.attempts).toHaveLength(1);
			expect(continued.value.history?.[0]?.attempts).toHaveLength(2);
			expect(continued.value.attempts[0]?.receipt?.sessionId).toBe("session-operation-1");
		}),
	));

test("continuing a PR after its merge wait must reacquire the area and clear the old timer", () => {
	let now = 100;
	return withEngine({ areaMergeWaitMs: 5000, backlog: 3, denyDelivery: true, now: () => now }, (fixture) =>
		Effect.gen(function* () {
			fixture.areas("one", ["fleet/host"]);
			fixture.areas("two", ["fleet/host"]);
			yield* prepareWork("one");
			yield* prepareWork("two");
			const fleet = yield* Fleet;
			yield* fleet.dispatch("one");
			finishWorkers(fixture);
			expect((yield* fleet.reconcile("one")).value.mergeReadyAt).toBe(100);
			now += 5000;
			yield* fleet.dispatch("two");
			expect(yield* fleet.continue("one", "Revise the PR").pipe(Effect.flip)).toMatchObject({ message: "waiting for area fleet/host held by two" });
			expect(fixture.operations.size).toBe(3);
			finishWorkers(fixture);
			const holder = yield* fleet.reconcile("two");
			const decision = holder.value.decision?.id ?? "missing";
			yield* fleet.resolve("two", decision, fixture.respond(decision, "release"));
			const continued = yield* fleet.continue("one", "Revise the PR");
			expect(continued.value.stage).toBe("executing");
			expect(continued.value.mergeReadyAt).toBeUndefined();
			expect(continued.value.mergeAreasReleased).toBeUndefined();
			expect(continued.value.history?.[0]?.mergeReadyAt).toBe(100);
		}),
	);
});
