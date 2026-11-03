import { Effect } from "effect";
import { Conflict } from "@shivaedev/errors/taxonomy.ts";
import { EngineContext } from "#engine/makeState.ts";
import { executing, type FleetRecord } from "#model.ts";
import type { Versioned } from "#storage/model.ts";

export const holdCiChanges = Effect.fn("Fleet.holdCiChanges")(function* (stored: Versioned<FleetRecord>) {
	const state = yield* EngineContext;
	const record = stored.value;
	if (
		record.result?.kind !== "change"
		|| ["done", "released", "queued"].includes(record.step)
		|| !(executing(record) || ["delivering", "waiting"].includes(record.step))
	) {
		return undefined;
	}
	const paths = record.result.paths.filter((path) => path.startsWith(".github/"));
	const hold = yield* state.integrations.ciHold?.(record.result, record.ciApprovedHead)
		?? Effect.succeed(paths.length > 0 && record.ciApprovedHead !== record.result.head ? { head: record.result.head, paths } : undefined);
	if (hold === undefined || executing(record)) {
		return undefined;
	}
	return yield* state.save(stored, {
		...record,
		attentionOwner: "orchestrator",
		blocker: `CI changes need orchestrator release at ${hold.head}: ${hold.paths.join(", ")}. Run work-fleet release-ci ${record.workId} ${hold.head}`,
		ciHold: hold,
		mergeQueue: undefined,
		mergeReadyAt: undefined,
		mergeReadyHead: undefined,
		step: "waiting",
	});
});

export const releaseCi = Effect.fn("Fleet.releaseCi")(function* (workId: string, head: string) {
	const state = yield* EngineContext;
	const stored = yield* state.load(workId);
	if (stored.value.ciHold?.head !== head) {
		return yield* new Conflict({ message: "The CI hold changed; release its current head" });
	}
	return yield* state.save(stored, {
		...stored.value,
		blocker: undefined,
		ciApprovedHead: head,
		ciHold: undefined,
		step: "delivering",
	});
});
