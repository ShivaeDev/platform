import { Clock, Console, Effect, FileSystem, Layer, Ref, Semaphore } from "effect";
import type { FleetHealth } from "@shivaedev/work-board/diagnostics/health.ts";
import { SourceFailure } from "@shivaedev/work-board/diagnostics/source.ts";
import { publishAfterBoardPass } from "#board/readPass.ts";
import { writeHealth } from "#board/writeHealth.ts";
import { writeStatus } from "#board/writeStatus.ts";
import { Health, HealthPublication, HealthSnapshot } from "#engine/health.ts";
import { views } from "#engine/views.ts";
import { Fleet } from "#fleet.ts";
import { executing } from "#model.ts";

export function statusLayer(root: string, healthConfig?: { readonly concurrency: number; readonly staleAfterMs: number }) {
	return Layer.unwrap(
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			const fs = yield* FileSystem.FileSystem;
			const realRoot = yield* fs.realPath(root);
			const lock = yield* Semaphore.make(1);
			const snapshot = yield* Ref.make<FleetHealth | null>(null);
			const publish = Semaphore.withPermits(
				lock,
				1,
			)(
				Effect.gen(function* () {
					const records = yield* fleet.list();
					yield* writeStatus(
						root,
						realRoot,
						records.map(({ value }) => value),
					).pipe(Effect.catch((error) => Console.error(`work-fleet: status publication failed: ${error.message}`)));
					if (healthConfig !== undefined) {
						const health = yield* Effect.serviceOption(Health);
						const state = health._tag === "Some" ? yield* Ref.get(health.value) : { lastCapacityRejection: null, lastSchedulerPass: null };
						const nextHealth: FleetHealth = {
							observedAt: yield* Clock.currentTimeMillis,
							version: 2,
							...healthConfig,
							...state,
							queued: records.filter(({ value }) => value.stage === "prepared").length,
							running: records.filter(({ value }) => executing(value)).length,
							waiting: waitingCounts(records.map(({ value }) => value)),
						};
						yield* Ref.set(snapshot, nextHealth);
						yield* writeHealth(root, realRoot, nextHealth);
					}
				}),
			).pipe(Effect.catch((error) => Console.error(`work-fleet: publication failed: ${error.message}`)));
			if (healthConfig !== undefined) {
				yield* publish;
			}
			function after<A, E, R>(effect: Effect.Effect<A, E, R>) {
				return effect.pipe(Effect.ensuring(publishAfterBoardPass(publish)));
			}
			return Layer.mergeAll(
				Layer.succeed(HealthSnapshot)(readSnapshot(snapshot)),
				Layer.succeed(HealthPublication)(publishAfterBoardPass(publish)),
				Layer.succeed(Fleet)({
					...fleet,
					continue: (workId, message) => after(fleet.continue(workId, message)),
					dispatch: (workId) => after(fleet.dispatch(workId)),
					list: () => after(fleet.list()),
					prepare: (input) => after(fleet.prepare(input)),
					reassign: (workId, decisionId, attentionOwner) => after(fleet.reassign(workId, decisionId, attentionOwner)),
					reconcile: (workId) => after(fleet.reconcile(workId)),
					resolve: (workId, decisionId, responseId) => after(fleet.resolve(workId, decisionId, responseId)),
				}),
			);
		}),
	);
}

function waitingCounts(records: Parameters<typeof views>[0]) {
	const { waiting } = views(records);
	return { automation: waiting.automation.length, maintainer: waiting.maintainer.length, orchestrator: waiting.orchestrator.length };
}

function readSnapshot(snapshot: Ref.Ref<FleetHealth | null>) {
	return Ref.get(snapshot).pipe(
		Effect.flatMap((value) =>
			value === null ? Effect.fail(new SourceFailure({ kind: "error", message: "Fleet health has not been observed" })) : Effect.succeed(value),
		),
	);
}
