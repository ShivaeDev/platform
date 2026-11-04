import { Effect } from "effect";
import { events } from "#events.ts";
import type { Emit } from "#health.ts";
import type { Options, Snapshot, State } from "#model.ts";
import { StateFile } from "#StateFile.ts";

export const commit = Effect.gen(function* () {
	const file = yield* StateFile;
	return <E, R>(state: State, snapshot: Snapshot, options: Options, emit: Emit<E, R>) =>
		Effect.uninterruptible(
			Effect.gen(function* () {
				const before = state.prs[String(snapshot.number)];
				const baseline =
					before === undefined && (snapshot.merged || snapshot.state === "closed") && state.openNumbers?.includes(snapshot.number)
						? { ...snapshot, merged: false, state: "open" as const }
						: before;
				for (const event of events(baseline, snapshot, options.events)) {
					yield* Effect.interruptible(emit(event));
				}
				const next = {
					...state,
					openNumbers: (state.openNumbers ?? []).filter((number) => number !== snapshot.number),
					prs: { ...state.prs, [String(snapshot.number)]: snapshot },
				};
				yield* file.save(options.stateFile, next);
				return next;
			}),
		);
});
