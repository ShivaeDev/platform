import { Stream } from "effect";
import type { State } from "#host/waitOutcome.ts";
import type { FleetFailure } from "#policy.ts";

type States = readonly (typeof State.Type)[];

export function snapshotStream(snapshots: Stream.Stream<States, FleetFailure>, ids: readonly string[]) {
	return Stream.suspend(() => {
		let selected = ids.length === 0 ? undefined : new Set(ids);
		return snapshots.pipe(
			Stream.map((states) => {
				selected ??= new Set(states.filter((state) => !["completed", "needs-human", "released"].includes(state.stage)).map((state) => state.workId));
				const selection = selected;
				return states.filter((state) => selection.has(state.workId));
			}),
		);
	});
}
