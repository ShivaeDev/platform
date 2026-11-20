import { Context, Effect } from "effect";

// The subject guard provides it to a delegated call; a live query's changes stream runs it before each update it sends. It never fails:
// once the rule refuses, it waits for the guard, which ends the call with the declared refusal.
export const SubjectRecheck = Context.Reference<Effect.Effect<void>>("@shivaedev/identity/SubjectRecheck", { defaultValue: () => Effect.void });
