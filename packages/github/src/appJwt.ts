import { Clock, Effect, type Redacted } from "effect";
import { signAppJwt } from "#adapters/signAppJwt.ts";

export interface AppCredentials {
	readonly appId: string;
	readonly privateKey: Redacted.Redacted<string>;
}

export const appJwt = Effect.fnUntraced(function* (options: AppCredentials) {
	const now = Math.floor((yield* Clock.currentTimeMillis) / 1000);
	return yield* signAppJwt(options, now);
});
