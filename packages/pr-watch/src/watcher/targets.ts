import { Effect } from "effect";
import { GitHub } from "#github/service.ts";
import type { Options, State } from "#model.ts";
import { StateFile } from "#state-file/service.ts";

function activeNumbers(options: Options, state: State) {
	return [...new Set([...options.numbers, ...(state.openNumbers ?? []), ...Object.keys(state.prs).map(Number)])].filter((number) => {
		const saved = state.prs[String(number)];
		return saved === undefined || (saved.state === "open" && !saved.merged);
	});
}

export const targets = Effect.fn("Watcher.targets")(function* (options: Options, state: State) {
	const file = yield* StateFile;
	const github = yield* GitHub;
	const discovered = options.fleet ? yield* github.discover(options) : [];
	const openNumbers = [...new Set([...(state.openNumbers ?? []), ...discovered])].filter((number) => state.prs[String(number)] === undefined);
	const next = openNumbers.length === (state.openNumbers?.length ?? 0) ? state : { ...state, openNumbers };
	if (next !== state) {
		yield* Effect.uninterruptible(file.save(options.stateFile, next));
	}
	const numbers = activeNumbers(options, next);
	const queue = numbers.length > 0 ? yield* github.queue(options) : new Set<number>();
	return { numbers, queue, state: next };
});
