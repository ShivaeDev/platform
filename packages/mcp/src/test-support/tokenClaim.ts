import { Clock } from "effect";
import { person } from "./host.ts";
import { mcp } from "./mcp.ts";
import { holdsToken } from "./traits.ts";

export function tokenClaim(name: string, claim: string, value: unknown) {
	return mcp.traits(
		holdsToken(name),
		mcp.trait(
			"tokens",
			`${name}'s signed token has ${claim} ${value === undefined ? "missing" : `set to ${JSON.stringify(value)}`}`,
			function* (engine) {
				const now = yield* Clock.currentTimeMillis;
				const claims: Record<string, unknown> = {
					aud: engine.resource,
					"client_id": engine.clientIds.get(name),
					exp: Math.floor(now / 1000) + 3600,
					"grant_id": engine.grantIds.get(name),
					iss: engine.issuer,
					scope: "mcp",
					sub: person(engine, name).id,
				};
				if (value === undefined) {
					delete claims[claim];
				} else {
					claims[claim] = value;
				}
				engine.tokens.set(name, engine.signToken(claims));
			},
		),
	);
}

export function referencesGrant(name: string, grantOwner: string) {
	return mcp.trait("tokens", `${name}'s token references ${grantOwner}'s grant`, function* (engine) {
		const now = yield* Clock.currentTimeMillis;
		engine.tokens.set(
			name,
			engine.signToken({
				aud: engine.resource,
				"client_id": engine.clientIds.get(name),
				exp: Math.floor(now / 1000) + 3600,
				"grant_id": engine.grantIds.get(grantOwner),
				iss: engine.issuer,
				scope: "mcp",
				sub: person(engine, name).id,
			}),
		);
	});
}
