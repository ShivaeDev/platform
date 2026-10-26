import { Data, Effect } from "effect";

export class ChangesetError extends Data.TaggedError("ChangesetError")<{
	readonly message: string;
	readonly cause?: unknown;
}> {}

export function attempt<A>(evaluate: () => A) {
	return Effect.try({
		catch: (cause) =>
			cause instanceof ChangesetError ? cause : new ChangesetError({ cause, message: cause instanceof Error ? cause.message : String(cause) }),
		try: evaluate,
	});
}

export function requireThat(condition: boolean, message: string): void {
	if (!condition) {
		throw new ChangesetError({ message });
	}
}
