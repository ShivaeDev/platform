import { Effect } from "effect";
import { expect } from "vitest";
import { cycle } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";

const test = postgresTests("test", "isolated");

test("a renewed revision queues behind existing area waiters", () =>
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
			fixture.editWork("one", "renewed-revision");
			fixture.approveWork("one", "renewed-revision");
			yield* prepareWork("one");
			yield* fleet.dispatch("one").pipe(Effect.result);
			expect((yield* fleet.get("one")).value.blocker).toContain("queued ahead by two");
			expect((yield* fleet.dispatch("two")).value.stage).toBe("executing");
		}),
	));

test("overlapping areas serialize concurrent dispatch and completion admits the next task", () =>
	withEngine({}, (fixture) =>
		Effect.gen(function* () {
			fixture.areas("one", ["fleet/host", "board/ui"]);
			fixture.areas("two", ["fleet/host"]);
			yield* prepareWork("one");
			yield* prepareWork("two");
			const fleet = yield* Fleet;
			yield* Effect.all(
				[fleet.dispatch("one"), fleet.dispatch("two")].map((work) => work.pipe(Effect.result)),
				{ concurrency: "unbounded" },
			);
			expect(fixture.launched).toHaveLength(1);
			yield* fleet.dispatch("two").pipe(Effect.result);
			expect((yield* fleet.get("two")).value).toMatchObject({
				attentionOwner: "automation",
				blocker: "waiting for area fleet/host held by one",
				stage: "prepared",
			});
			finishWorkers(fixture);
			expect((yield* fleet.reconcile("one")).value.stage).toBe("completed");
			const next = yield* fleet.dispatch("two");
			expect(next.value.stage).toBe("executing");
			expect(next.value.blocker).toBeUndefined();
		}),
	));

test("disjoint areas dispatch concurrently", () =>
	withEngine({}, (fixture) =>
		Effect.gen(function* () {
			fixture.areas("one", ["fleet/host"]);
			fixture.areas("two", ["board/ui"]);
			yield* prepareWork("one");
			yield* prepareWork("two");
			const fleet = yield* Fleet;
			const dispatched = yield* Effect.all([fleet.dispatch("one"), fleet.dispatch("two")], { concurrency: "unbounded" });
			expect(dispatched.map(({ value }) => value.stage)).toEqual(["executing", "executing"]);
			expect(fixture.launched).toHaveLength(2);
		}),
	));

test("a safe human release frees the held area", () =>
	withEngine({ denyDelivery: true }, (fixture) =>
		Effect.gen(function* () {
			fixture.areas("one", ["fleet/host"]);
			fixture.areas("two", ["fleet/host"]);
			yield* prepareWork("one");
			yield* prepareWork("two");
			const fleet = yield* Fleet;
			yield* fleet.dispatch("one");
			finishWorkers(fixture);
			const holder = yield* fleet.reconcile("one");
			yield* fleet.dispatch("two").pipe(Effect.result);
			expect((yield* fleet.get("two")).value.stage).toBe("prepared");
			const decision = holder.value.decision?.id ?? "missing";
			expect((yield* fleet.resolve("one", decision, fixture.respond(decision, "release"))).value.stage).toBe("released");
			expect((yield* fleet.dispatch("two")).value.stage).toBe("executing");
		}),
	));

test("restart preserves waiting order and racing dispatchers do not double launch", () =>
	withEngine({}, (fixture) =>
		Effect.gen(function* () {
			for (const id of ["one", "two", "dependent"]) {
				fixture.areas(id, ["fleet/host"]);
				fixture.dependencies(id, []);
				yield* prepareWork(id);
			}
			const fleet = yield* Fleet;
			yield* fleet.dispatch("one");
			yield* cycle;
			expect((yield* fleet.get("two")).value.blocker).toContain("held by one");
			expect((yield* fleet.get("dependent")).value.blocker).toContain("held by one");
			finishWorkers(fixture);
			yield* fleet.reconcile("one");
			yield* fixture.restart(
				Effect.gen(function* () {
					const restarted = yield* Fleet;
					yield* Effect.all(
						[restarted.dispatch("dependent"), restarted.dispatch("two"), restarted.dispatch("two")].map((work) => work.pipe(Effect.result)),
						{ concurrency: "unbounded" },
					);
					expect((yield* restarted.get("two")).value.stage).toBe("executing");
					expect((yield* restarted.get("dependent")).value.stage).toBe("prepared");
					expect((yield* restarted.get("two")).value.attempts).toHaveLength(1);
					finishWorkers(fixture);
					yield* restarted.reconcile("two");
					yield* cycle;
					expect((yield* restarted.get("dependent")).value.stage).toBe("executing");
				}),
			);
			expect(fixture.starts.filter((start) => start.access !== "read-only").map((start) => start.prompt)).toEqual([
				"Implement one",
				"Implement two",
				"Implement dependent",
			]);
		}),
	));
