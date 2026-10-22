import { Stream } from "effect";
import { ANSWER_RECORDED } from "#attention.ts";
import type { FleetError } from "#errors.ts";
import type { State } from "#host/waitOutcome.ts";

type States = readonly (typeof State.Type)[];

export function snapshotStream(snapshots: Stream.Stream<States, FleetError>, ids: readonly string[], continuous = false) {
	return Stream.suspend(() => {
		let selected = ids.length === 0 ? undefined : new Set(ids);
		return snapshots.pipe(
			Stream.map((states) => {
				if (continuous && selected === undefined) {
					return states;
				}
				selected ??= new Set(
					states
						.filter((state) => state.blocker === ANSWER_RECORDED || !["done", "waiting", "released"].includes(state.stage))
						.map((state) => state.workId),
				);
				const selection = selected;
				return states.filter((state) => selection.has(state.workId));
			}),
		);
	});
}
