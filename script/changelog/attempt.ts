import { Data, Effect } from "effect";

export class ChangelogFailure extends Data.TaggedError("ChangelogFailure")<{
	readonly message: string;
}> {}

export function attempt<TValue>(action: () => TValue): Effect.Effect<TValue, ChangelogFailure> {
	return Effect.try({
		catch: (error) => new ChangelogFailure({ message: error instanceof Error ? error.message : String(error) }),
		try: action,
	});
}
