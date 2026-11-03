import { Effect } from "effect";
import type { Engine } from "./engine.ts";
import type { Read } from "./github.ts";
import { REPOSITORY } from "./githubModel.ts";
import { pollOnce } from "./watcherVerbs.ts";

export function roundVerbs(engine: Engine, tell: (line: string) => void) {
	return {
		holdReply: (read: Read) =>
			Effect.sync(() => {
				tell(`GitHub holds its answer to ${read.name}`);
				const held = engine.github.holdRequest(`${REPOSITORY}${read.route(engine.github)}`);
				return {
					arrived: held.arrived.pipe(Effect.timeout("5 seconds")),
					release: () =>
						Effect.sync(() => {
							tell(`GitHub releases its answer to ${read.name}`);
							held.release();
						}),
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
