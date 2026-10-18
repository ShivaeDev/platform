import { Effect } from "effect";
import type { EngineState } from "#engine/makeState.ts";
import { retryPending } from "#engine/readRetry.ts";
import { repairAreaClaims } from "#engine/repairAreaClaims.ts";
import type { FleetRecord } from "#model.ts";
import type { Priority } from "#policy.ts";
import type { Versioned } from "#storage/model.ts";

const ranks: Readonly<Record<Priority, number>> = { high: 1, normal: 2, urgent: 0 };

export function admissionOrder(state: EngineState) {
	return Effect.fn("Fleet.admissionOrder")(function* (records: readonly Versioned<FleetRecord>[]) {
		yield* repairAreaClaims(state.store, records);
		const prepared = records.filter(({ value }) => value.stage === "prepared");
		const ranked = yield* Effect.forEach(prepared, (entry) =>
			retryPending(state, entry.value)
				? Effect.succeed({ entry, rank: ranks.normal })
				: state.board.get(entry.value.workId).pipe(
						Effect.map((work) => ({ entry, rank: ranks[work.priority ?? "normal"] })),
						Effect.orElseSucceed(() => ({ entry, rank: ranks.normal })),
					),
		);
		return ranked
			.sort((left, right) => (right.entry.value.launchRetry?.retryAt ?? 0) - (left.entry.value.launchRetry?.retryAt ?? 0) || left.rank - right.rank)
			.map(({ entry }) => entry);
	});
}
