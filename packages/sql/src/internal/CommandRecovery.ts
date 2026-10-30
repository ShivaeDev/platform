import { Context, Effect } from "effect";

export const CommandRecovery = Context.Reference<Effect.Effect<void>>("@shivaedev/sql/CommandRecovery", {
	defaultValue: () => Effect.void,
});
