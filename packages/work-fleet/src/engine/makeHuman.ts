import { Effect } from "effect";
import type { EngineState } from "#engine/makeState.ts";
import { originalWork } from "#engine/originalWork.ts";
import { resolveCommand } from "#engine/resolveCommand.ts";
import type { FleetRecord } from "#model.ts";
import { BoardFailure, FleetFailure } from "#policy.ts";
import type { Versioned } from "#storage/model.ts";

export function makeHuman(state: EngineState) {
	return Effect.fn("Fleet.makeHuman")(function* (input: Versioned<FleetRecord>) {
		let stored = input;
		const decision = stored.value.decision;
		if (stored.value.stage !== "needs-human" || decision === undefined) {
			return stored;
		}
		if (!stored.value.decisionPublished || decision.published === undefined) {
			const published = yield* state.board.decision(stored.value.workId, decision, originalWork(stored.value));
			stored = yield* state.save(stored, { ...stored.value, decision: { ...decision, published }, decisionPublished: true });
		}
		const published = stored.value.decision?.published;
		if (published === undefined) {
			return stored;
		}
		const reading = yield* state.board.readDecision(published);
		if (reading._tag === "Pending") {
			return stored;
		}
		if (reading._tag !== "Response") {
			const blocker = reading._tag === "Stale" ? reading.reason : "Several Board answers compete; explicitly supersede the other responses";
			return yield* state.save(stored, { ...stored.value, blocker });
		}
		return yield* resolveCommand(state)(stored.value.workId, decision.id, reading.response.id).pipe(
			Effect.catch((error) =>
				error instanceof FleetFailure || error instanceof BoardFailure
					? state.save(stored, { ...stored.value, blocker: error.message })
					: Effect.fail(error),
			),
		);
	});
}
