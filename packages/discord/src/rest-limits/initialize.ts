import { Effect, Ref } from "effect";

export const initialize = Effect.gen(function* () {
	return {
		blocked: new Map<string, number>(),
		globalReset: yield* Ref.make(0),
		routes: new Map<string, string>(),
	};
});
