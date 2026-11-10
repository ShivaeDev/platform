import { Effect, FiberSet } from "effect";

export const clientErrorReporter = Effect.fnUntraced(function* <R>(report: (error: Error) => Effect.Effect<unknown, never, R>) {
	const run = yield* FiberSet.makeRuntime<R>();
	return (error: Error): void => {
		run(Effect.exit(Effect.suspend(() => report(error))));
	};
});
