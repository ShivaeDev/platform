import { changeTokenClaim } from "./changeTokenClaim.ts";
import { mcp } from "./mcp.ts";
import { holdsToken } from "./traits.ts";

export function tokenClaim(name: string, claim: string, value: unknown) {
	return mcp.traits(
		holdsToken(name),
		mcp.trait("tokens", `${name}'s signed token has ${claim} ${value === undefined ? "missing" : `set to ${JSON.stringify(value)}`}`, (engine) =>
			changeTokenClaim(engine, name, claim, value),
		),
	);
}

export function referencesGrant(name: string, grantOwner: string) {
	return mcp.trait("tokens", `${name}'s token references ${grantOwner}'s grant`, function* (engine) {
		yield* changeTokenClaim(engine, name, "grant_id", engine.grantIds.get(grantOwner));
	});
}
