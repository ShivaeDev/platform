import { Console, Effect, FileSystem, Layer, Semaphore } from "effect";
import { writeStatus } from "#board/writeStatus.ts";
import { Fleet } from "#fleet.ts";

export function statusLayer(root: string) {
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
					);
				}),
			).pipe(Effect.catch((error) => Console.error(`work-fleet: status publication failed: ${error.message}`)));
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
