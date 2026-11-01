import { Effect } from "effect";
import { logClientError } from "#internal/clientErrors.ts";

export const clientErrorLogger = Effect.fnUntraced(function* () {
	const run = Effect.runForkWith(yield* Effect.context<never>());
	return (error: Error): void => {
		run(Effect.exit(logClientError(error)));
	};
});
