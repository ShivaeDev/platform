import { Effect } from "effect";
import type { Emit, makeOutput } from "#health.ts";
import type { Options } from "#model.ts";
import { pollRetries } from "#pollRetries.ts";
import { Watcher } from "#Watcher.ts";

export const polling = Effect.fn("PrWatch.polling")(function* (
	options: Options,
	once: boolean,
	output: Effect.Success<ReturnType<typeof makeOutput>>,
	report: { error: Emit; reset: () => void },
) {
	const watcher = yield* Watcher;
	let state = yield* watcher.load(options);
	const retries = pollRetries(options.interval);
	while (true) {
		yield* retries.check;
		report.reset();
		const result = yield* Effect.result(watcher.poll(options, state, output.emit, report.error));
		if (result._tag === "Failure") {
			const error = result.failure;
			if (once || error.retryable !== true) {
				return yield* error;
			}
			yield* report.error(error.message);
			state = yield* watcher.load(options);
			const pacing = yield* watcher.pacing(options.interval);
			const delay = yield* retries.delay(error, pacing.delay);
			const reason = pacing.delay > options.interval ? `; ${pacing.message}` : "";
			yield* output.waitForPoll(options.interval, delay, `Retrying: ${error.message}${reason}`);
			continue;
		}
		state = result.success;
		retries.reset();
		if (once) {
			return;
		}
		const pacing = yield* watcher.pacing(options.interval);
		yield* output.waitForPoll(options.interval, pacing.delay, pacing.message);
	}
});
