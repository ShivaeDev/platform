import { Effect } from "effect";
import { argumentsFor, help } from "./arguments.ts";
import type { WatchError } from "./model.ts";
import { Watcher } from "./Watcher.ts";
export const program = Effect.fn("PrWatch.program")(function* (
	args: readonly string[],
	token: string,
	emit: (line: string) => Effect.Effect<void, WatchError>,
	diagnostic: (message: string) => Effect.Effect<void, WatchError>,
) {
	const parsed = yield* argumentsFor(args, token);
	if (parsed.help) {
		yield* emit(help);
		return;
	}
	const watcher = yield* Watcher;
	let state = yield* watcher.load(parsed.options);
	while (true) {
		const result = yield* Effect.result(watcher.poll(parsed.options, state, emit, diagnostic));
		if (result._tag === "Success") {
			state = result.success;
		} else {
			if (parsed.once) {
				return yield* Effect.fail(result.failure);
			}
			yield* diagnostic(result.failure.message);
			state = yield* watcher.load(parsed.options);
		}
		if (parsed.once) {
			return;
		}
		yield* Effect.sleep(yield* watcher.delay(parsed.options.interval));
	}
});
