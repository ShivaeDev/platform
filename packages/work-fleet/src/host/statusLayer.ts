import { Clock, Console, Effect, FileSystem, Layer, Ref, Semaphore } from "effect";
import { writeHealth } from "#board/writeHealth.ts";
import { writeStatus } from "#board/writeStatus.ts";
import { Health } from "#engine/health.ts";
import { Fleet } from "#fleet.ts";
import { executing } from "#model.ts";

export function statusLayer(root: string, healthConfig?: { readonly concurrency: number; readonly staleAfterMs: number }) {
	return Layer.effect(Fleet)(
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			const fs = yield* FileSystem.FileSystem;
			const realRoot = yield* fs.realPath(root);
			const lock = yield* Semaphore.make(1);
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
						yield* writeHealth(root, realRoot, {
							observedAt: yield* Clock.currentTimeMillis,
							version: 1,
							...healthConfig,
							...state,
							needsHuman: records.filter(({ value }) => value.stage === "needs-human").length,
							queued: records.filter(({ value }) => value.stage === "prepared").length,
							running: records.filter(({ value }) => executing(value)).length,
						});
					}
				}),
			).pipe(Effect.catch((error) => Console.error(`work-fleet: publication failed: ${error.message}`)));
			if (healthConfig !== undefined) {
				yield* publish;
			}
			function after<A, E, R>(effect: Effect.Effect<A, E, R>) {
				return effect.pipe(Effect.ensuring(publish));
			}
			return Fleet.of({
				...fleet,
				dispatch: (workId) => after(fleet.dispatch(workId)),
				list: () => after(fleet.list()),
				prepare: (input) => after(fleet.prepare(input)),
				reassign: (workId, decisionId, attentionOwner) => after(fleet.reassign(workId, decisionId, attentionOwner)),
				reconcile: (workId) => after(fleet.reconcile(workId)),
				resolve: (workId, decisionId, responseId) => after(fleet.resolve(workId, decisionId, responseId)),
			});
		}),
	);
}
