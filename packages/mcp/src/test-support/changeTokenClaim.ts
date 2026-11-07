import { verifyJwsAccessToken } from "better-auth/oauth2";
import { Effect } from "effect";
import type { Engine } from "#test/host.ts";

export const changeTokenClaim = Effect.fnUntraced(function* (engine: Engine, name: string, claim: string, value: unknown) {
	const token = engine.tokens.get(name);
	if (token === undefined) {
		throw new Error(`${name} has no token`);
	}
	const claims = yield* Effect.promise(() =>
		verifyJwsAccessToken(token, { jwksFetch: engine.jwks.keys, verifyOptions: { audience: engine.resource, issuer: engine.issuer } }),
	);
	if (value === undefined) {
		delete claims[claim];
	} else {
		claims[claim] = value;
	}
	engine.tokens.set(name, engine.signToken(claims));
});
