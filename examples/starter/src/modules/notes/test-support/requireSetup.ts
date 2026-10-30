import { Data, Effect } from "effect";

class SetupFailure extends Data.TaggedError("SetupFailure")<{ readonly message: string }> {}

export function requireSetup(condition: boolean, message: string) {
	return condition ? Effect.void : Effect.fail(new SetupFailure({ message }));
}
