import { Effect, Layer } from "effect";
import type { BoardDecision } from "#board/schema.ts";
import { BoardGateway } from "#policy.ts";
import type { HostStoryEngine } from "#test/HostStoryEngine.ts";
import { host } from "#test/hostStory.ts";

export function answerReadConflict(conflict: "decision" | "version") {
	return host.trait("configuration", `the ${conflict} changes while Fleet reads its answer`, (engine) => {
		engine.board = (fixture) => {
			if (fixture.parts.board === undefined) {
				throw new Error("Expected the fixture Board layer");
			}
			return Layer.effect(BoardGateway)(conflictingReads(engine, conflict)).pipe(Layer.provideMerge(fixture.parts.board));
		};
	});
}

const conflictingReads = Effect.fnUntraced(function* (engine: HostStoryEngine, conflict: "decision" | "version") {
	const board = yield* BoardGateway;
	let responses = 0;
	const readDecision = Effect.fnUntraced(function* (input: BoardDecision) {
		const reading = yield* board.readDecision(input);
		if (reading._tag !== "Response") {
			return reading;
		}
		responses += 1;
		if (conflict === "decision" && responses === 1) {
			yield* engine.fleet.reassign(input.workId, input.request, "maintainer").pipe(Effect.orDie);
		}
		if (conflict === "version" && responses === 2) {
			const current = yield* engine.fleet.get(input.workId).pipe(Effect.orDie);
			yield* engine.store(input.workId, current.value).pipe(Effect.orDie);
		}
		return reading;
	});
	return { ...board, readDecision };
});
