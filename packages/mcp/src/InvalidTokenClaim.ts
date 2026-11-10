import { Data } from "effect";

export class InvalidTokenClaim extends Data.TaggedError("InvalidTokenClaim")<{
	readonly claim: string;
}> {
	override get message() {
		return `MCP access token has a missing or invalid ${this.claim} claim`;
	}
}
