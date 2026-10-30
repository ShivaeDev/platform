import { sign } from "node:crypto";
import { Clock, Effect, Redacted } from "effect";
import { GitHubAppError } from "#errors.ts";

export interface AppCredentials {
	readonly appId: string;
	readonly privateKey: Redacted.Redacted<string>;
}

export const appJwt = Effect.fnUntraced(function* (options: AppCredentials) {
	const now = Math.floor((yield* Clock.currentTimeMillis) / 1000);
	return yield* Effect.try({
		catch: (cause) => new GitHubAppError({ reason: "sign" }, { cause }),
		try: () => {
			const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
			const payload = Buffer.from(JSON.stringify({ exp: now + 600, iat: now - 60, iss: options.appId })).toString("base64url");
			const input = `${header}.${payload}`;
			return Redacted.make(`${input}.${sign("RSA-SHA256", Buffer.from(input), Redacted.value(options.privateKey)).toString("base64url")}`);
		},
	});
});
