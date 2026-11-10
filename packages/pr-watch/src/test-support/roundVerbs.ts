import { Effect } from "effect";
import type { Engine } from "#test/engine.ts";
import type { Read } from "#test/github.ts";
import { REPOSITORY } from "#test/githubModel.ts";
import { pollOnce } from "#test/watcherVerbs.ts";

export function roundVerbs(engine: Engine, tell: (line: string) => void) {
	return {
		holdReply: (read: Read) =>
			Effect.gen(function* () {
				tell(`GitHub holds its answer to ${read.name}`);
				const held = yield* engine.github.holdRequest(`${REPOSITORY}${read.route(engine.github)}`);
				return {
					arrived: held.waiting.pipe(Effect.timeout("5 seconds")),
					release: () => Effect.sync(() => tell(`GitHub releases its answer to ${read.name}`)).pipe(Effect.andThen(held.release)),
				};
			}),
		roundCompleted: () => engine.github.roundCompleted.pipe(Effect.timeout("5 seconds")),
		startPoll: () =>
			Effect.gen(function* () {
				tell("the watcher starts polling GitHub");
				yield* Effect.forkChild(pollOnce(engine));
			}),
	};
}
