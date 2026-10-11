import { Data, Effect, Runtime } from "effect";

export class ChangelogFailure extends Data.TaggedError("ChangelogFailure")<{
	readonly message: string;
}> {
	override readonly [Runtime.errorReported] = false;
}

export function attempt<TValue>(action: () => TValue): Effect.Effect<TValue, ChangelogFailure> {
	return Effect.try({
		catch: (error) => new ChangelogFailure({ message: error instanceof Error ? error.message : String(error) }),
		try: action,
	});
}
