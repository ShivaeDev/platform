import { Effect } from "effect";
import { Digest } from "effect/crypto";

export const defaultChangesChannel = Effect.fnUntraced(function* (name: string) {
	const digest = yield* Digest.Digest;
	const hash = yield* digest.digestHex(Digest.sha256, new TextEncoder().encode(name));
	return `changes_${hash.slice(0, 32)}`;
});
