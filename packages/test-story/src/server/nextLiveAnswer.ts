import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Stream from "effect/Stream";
import type { LiveAnswerSignal } from "#server/LiveAnswerSignal.ts";
import { SignalNotReceived } from "#server/until.ts";

export const nextLiveAnswer = Effect.fnUntraced(function* (answers: LiveAnswerSignal, before: number, timeoutMs: number) {
	function missing(reason: string) {
		return new SignalNotReceived({
			message: [
				`Waited for a live answer to ${answers.name} after the action above, none arrived: ${reason}.`,
				"help: the server pushed no result for this query after the action. Check that the action changes what the query",
				"      reads, or settle without this wait when the command's own reply updates the screen.",
			].join("\n"),
		});
	}
	const answer = answers.answered.pipe(
		Stream.filter((completed) => completed > before),
		Stream.runHead,
		Effect.flatMap((found) => (Option.isSome(found) ? Effect.void : Effect.fail(missing("the query's answers ended")))),
	);
	const deadline = Effect.sleep(timeoutMs).pipe(Effect.andThen(Effect.fail(missing(`nothing came within ${timeoutMs}ms`))));
	return yield* Effect.raceFirst(answer, deadline);
});
