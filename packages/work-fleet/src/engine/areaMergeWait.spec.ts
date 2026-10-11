import { Effect } from "effect";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { Fleet } from "#fleet.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

const test = it.effect.skipIf(storageDatabaseUrl === undefined);

test("the default merge wait frees areas after thirty minutes and continues observing delivery across restart", () => {
	let now = 100;
	let merged = false;
	return withEngine(
		{ deliveryQuery: (result) => Effect.succeed(merged ? { head: result.head, revision: "merged", url: result.pr } : undefined), now: () => now },
		(fixture) =>
			Effect.gen(function* () {
				fixture.areas("one", ["fleet/host"]);
				fixture.areas("two", ["fleet/host"]);
				yield* prepareWork("one");
				yield* prepareWork("two");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				expect((yield* fleet.reconcile("one")).value).toMatchObject({
					attentionOwner: "maintainer",
					decision: { attentionOwner: "maintainer" },
					mergeReadyAt: 100,
					mergeReadyHead: "head-one-0",
					stage: "needs-human",
				});
				now += 1_800_000 - 1;
				yield* fleet.reconcile("one");
				expect((yield* fleet.get("one")).value.mergeReadyAt).toBe(100);
				yield* fleet.dispatch("two").pipe(Effect.result);
				expect((yield* fleet.get("two")).value.stage).toBe("prepared");
				now += 1;
				yield* fixture.restart(
					Effect.gen(function* () {
						const restarted = yield* Fleet;
						expect((yield* restarted.dispatch("two")).value.stage).toBe("executing");
						expect((yield* restarted.get("one")).value).toMatchObject({
							attentionOwner: "maintainer",
							decision: { attentionOwner: "maintainer" },
							stage: "needs-human",
						});
						merged = true;
						expect((yield* restarted.reconcile("one")).value).toMatchObject({ outcome: { revision: "merged" }, stage: "completed" });
					}),
				);
			}),
	);
});

test("a configured merge wait uses readiness time rather than worker start time", () => {
	let now = 100;
	return withEngine({ areaMergeWaitMs: 5000, denyDelivery: true, now: () => now }, (fixture) =>
		Effect.gen(function* () {
			fixture.areas("one", ["fleet/host"]);
			fixture.areas("two", ["fleet/host"]);
			yield* prepareWork("one");
			yield* prepareWork("two");
			const fleet = yield* Fleet;
			yield* fleet.dispatch("one");
			now = 20_000;
			finishWorkers(fixture);
			expect((yield* fleet.reconcile("one")).value.mergeReadyAt).toBe(20_000);
			yield* fleet.dispatch("two").pipe(Effect.result);
			expect((yield* fleet.get("two")).value.stage).toBe("prepared");
			now += 5000;
			expect((yield* fleet.dispatch("two")).value.stage).toBe("executing");
		}),
	);
});

test("a worker or unfinished review holds its area regardless of elapsed time", () => {
	let now = 100;
	return withEngine({ areaMergeWaitMs: 5000, now: () => now, reviewRunning: true }, (fixture) =>
		Effect.gen(function* () {
			fixture.areas("one", ["fleet/host"]);
			fixture.areas("two", ["fleet/host"]);
			yield* prepareWork("one");
			yield* prepareWork("two");
			const fleet = yield* Fleet;
			yield* fleet.dispatch("one");
			now = 20_000;
			yield* fleet.dispatch("two").pipe(Effect.result);
			expect((yield* fleet.get("two")).value.stage).toBe("prepared");
			finishWorkers(fixture);
			const reviewing = yield* fleet.reconcile("one");
			expect(reviewing.value.stage).toBe("reviewing");
			expect(reviewing.value.mergeReadyAt).toBeUndefined();
			yield* fleet.dispatch("two").pipe(Effect.result);
			expect((yield* fleet.get("two")).value.blocker).toContain("held by one");
		}),
	);
});
