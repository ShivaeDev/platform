import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { vi } from "vitest";
import { fleetHealth } from "@shivaedev/work-board/diagnostics/fleetHealth.ts";
import { withBoardReadPass } from "#board/readPass.ts";
import * as status from "#board/writeStatus.ts";
import { capacityRejected, HealthSnapshot } from "#engine/health.ts";
import { cycle } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import { finishWorkers, prepareWork } from "#test/engine.ts";
import { blockedHealth } from "#test/health.ts";
import { postgresTests } from "#test/postgres.ts";
import { blockedStatus } from "#test/status.ts";
import { withFleetBoard } from "#test/withFleetBoard.ts";
import { healthLayer } from "./healthLayer.ts";
import { statusLayer } from "./statusLayer.ts";

const test = postgresTests("live");
test("publishes an idle scheduler pass from one snapshot without an extra list request", () =>
	withFleetBoard({}, (_fixture, root) =>
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			let reads = 0;
			yield* cycle.pipe(
				Effect.provideService(Fleet, {
					...fleet,
					list: () =>
						Effect.sync(() => {
							reads += 1;
						}).pipe(Effect.andThen(fleet.list())),
				}),
			);
			expect(reads).toBe(1);
			expect((yield* fleetHealth(root)).lastSchedulerPass).toBeGreaterThan(0);
		}).pipe(
			Effect.provide(
				statusLayer(root, Effect.succeed({ concurrency: 8, staleAfterMs: 60_000 })).pipe(
					Layer.provideMerge(healthLayer(root)),
					Layer.provide(NodeServices.layer),
				),
			),
		),
	));

test("publishes counts, configured cap, scheduler pass and provider rejection through the shared Board contract", () =>
	withFleetBoard({ denyDelivery: true }, (fixture, root) =>
		Effect.gen(function* () {
			expect(yield* fleetHealth(root)).toMatchObject({ concurrency: 8, lastSchedulerPass: null, queued: 0, running: 0 });
			const heal = yield* blockedStatus(root);
			yield* prepareWork("one");
			expect(yield* fleetHealth(root)).toMatchObject({ queued: 1, running: 0 });
			yield* Effect.sync(heal);
			yield* capacityRejected("serverOverloaded");
			yield* cycle;
			const running = yield* fleetHealth(root);
			expect(running).toMatchObject({ concurrency: 8, lastCapacityRejection: { cause: "serverOverloaded" }, queued: 0, running: 1 });
			expect(running.lastSchedulerPass).toBeGreaterThan(0);
			finishWorkers(fixture);
			yield* cycle;
			expect(yield* fleetHealth(root)).toMatchObject({ running: 0, waiting: { automation: 0, maintainer: 1, orchestrator: 0 } });
			const fleet = yield* Fleet;
			for (const owner of ["orchestrator", "automation"] as const) {
				const decision = (yield* fleet.get("one")).value.decision;
				if (decision === undefined) {
					return yield* Effect.die("Missing waiting decision");
				}
				yield* fleet.reassign("one", decision.id, owner);
				expect((yield* fleetHealth(root)).waiting).toEqual({
					automation: Number(owner === "automation"),
					maintainer: 0,
					orchestrator: Number(owner === "orchestrator"),
				});
			}
		}).pipe(
			Effect.provide(
				statusLayer(root, Effect.succeed({ concurrency: 8, staleAfterMs: 60_000 })).pipe(
					Layer.provideMerge(healthLayer(root)),
					Layer.provide(NodeServices.layer),
				),
			),
		),
	));

test("failed health publication leaves execution usable and retries on the next observation", () =>
	withFleetBoard({}, (_fixture, root) =>
		Effect.gen(function* () {
			const heal = blockedHealth(root);
			yield* prepareWork("one");
			yield* cycle;
			const fleet = yield* Fleet;
			expect((yield* fleet.get("one")).value.stage).toBe("executing");
			expect(yield* fleetHealth(root).pipe(Effect.flip)).toMatchObject({ kind: "error" });
			expect(yield* yield* HealthSnapshot).toMatchObject({ concurrency: 8, queued: 0, running: 1 });
			yield* Effect.sync(heal);
			yield* cycle;
			expect(yield* fleetHealth(root)).toMatchObject({ concurrency: 8, queued: 0, running: 1 });
		}).pipe(
			Effect.provide(
				statusLayer(root, Effect.succeed({ concurrency: 8, staleAfterMs: 60_000 })).pipe(
					Layer.provideMerge(healthLayer(root)),
					Layer.provide(NodeServices.layer),
				),
			),
		),
	));

test("publishes the final PostgreSQL state once after a batch of Fleet calls", () =>
	withFleetBoard({}, (_fixture, root) =>
		Effect.gen(function* () {
			const writes = vi.spyOn(status, "writeStatus");
			yield* Effect.addFinalizer(() => Effect.sync(() => writes.mockRestore()));
			yield* withBoardReadPass(
				Effect.gen(function* () {
					yield* prepareWork("one");
					const fleet = yield* Fleet;
					yield* fleet.list();
					yield* fleet.dispatch("one");
					expect(writes).not.toHaveBeenCalled();
				}),
			);
			expect(writes).toHaveBeenCalledTimes(1);
			expect(yield* fleetHealth(root)).toMatchObject({ queued: 0, running: 1 });
		}).pipe(
			Effect.provide(
				statusLayer(root, Effect.succeed({ concurrency: 8, staleAfterMs: 60_000 })).pipe(
					Layer.provideMerge(healthLayer(root)),
					Layer.provide(NodeServices.layer),
				),
			),
		),
	));
