import { Effect, Option } from "effect";
import { type Engine, named } from "./host.ts";

export function tokenVerbs(engine: Engine, tell: (line: string) => void) {
	return {
		authenticates: (name: string) =>
			Effect.suspend(() => {
				tell(`the application authenticates ${name}'s MCP token`);
				return engine.oauth.authenticate(engine.tokens.get(name));
			}).pipe(
				Effect.map((session) => (Option.isNone(session) ? "grant refused" : `signed in as ${named(engine, session.value.user.id)}`)),
				Effect.catchTag("InvalidTokenClaim", (error) => Effect.succeed({ claim: error.claim, refusal: "invalid token claim" })),
				Effect.provide(engine.jwks.logger),
			),
		tokenClaimLogs: () =>
			Effect.sync(() =>
				engine.jwks.logs.filter(([message]) => typeof message === "string" && message.startsWith("MCP access token has a missing or invalid ")),
			),
	};
}
