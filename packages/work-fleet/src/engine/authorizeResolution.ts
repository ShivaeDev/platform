import { Effect } from "effect";
import { Forbidden } from "@shivaedev/platform/errors/taxonomy.ts";
import { authorizeBrief } from "#engine/boardBrief.ts";
import type { EngineState } from "#engine/makeState.ts";
import { executing, type FleetRecord } from "#model.ts";

export const authorizeResolution = Effect.fn("Fleet.authorizeResolution")(function* (
	{ board, store }: EngineState,
	record: FleetRecord,
	action: "retry" | "release",
) {
	if (action === "retry") {
		const work = yield* board.get(record.workId);
		yield* authorizeBrief(work);
		return;
	}
	if (executing(record)) {
		return yield* Effect.fail(new Forbidden({ message: "Confirm terminal execution before releasing ownership" }));
	}
	if (record.result?.kind === "change") {
		yield* store.reserveForeign(record.result.pr, { backlog: true, executing: false });
	}
});
