import { Context, Effect } from "effect";

// A child-process check runs this once its child is running, so the run starts the in-process rules only after their synchronous work can no longer delay the child's start.
export const ChildStarted = Context.Reference<Effect.Effect<void>>("@shivaedev/quality/ChildStarted", { defaultValue: () => Effect.void });

export const childStarted = Effect.fn("Engine.childStarted")(function* () {
	yield* yield* ChildStarted;
});
