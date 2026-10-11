import { Effect, PubSub, Stream } from "effect";
import type { FleetFailure } from "#policy.ts";
import type { State } from "./waitOutcome.ts";

type States = readonly (typeof State.Type)[];
export type Snapshot = Effect.Effect<States, FleetFailure>;

export function snapshotStream(events: PubSub.PubSub<Snapshot>, read: Snapshot, ids: readonly string[]) {
	return Stream.unwrap(
		Effect.gen(function* () {
			const subscription = yield* PubSub.subscribe(events);
			const initial = yield* read;
			const selected = new Set(
				ids.length === 0
					? initial.filter((state) => !["completed", "needs-human", "released"].includes(state.stage)).map((state) => state.workId)
					: ids,
			);
			return Stream.concat(Stream.succeed(initial), Stream.fromSubscription(subscription).pipe(Stream.mapEffect((snapshot) => snapshot))).pipe(
				Stream.map((states) => states.filter((state) => selected.has(state.workId))),
			);
		}),
	);
}
