import { Context, type Effect, type Option, type Redacted } from "effect";

type Refresh = (rejected: Option.Option<Redacted.Redacted<string>>) => Effect.Effect<unknown>;

export const TokenRefresh = Context.Reference<Refresh | undefined>("@shivaedev/effect-github/TokenRefresh", {
	defaultValue: () => undefined,
});
