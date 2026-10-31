import { Effect } from "effect";

export const clientErrorReporter = Effect.fnUntraced(function* <R>(report: (error: Error) => Effect.Effect<unknown, never, R>) {
	const run = Effect.runPromiseWith(yield* Effect.context<R>());
	return (error: Error): void => {
		void run(Effect.exit(report(error)));
	};
});
