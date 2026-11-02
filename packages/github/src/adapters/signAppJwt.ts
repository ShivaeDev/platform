import { sign } from "node:crypto";
import { Effect, Redacted } from "effect";
import type { AppCredentials } from "#appJwt.ts";
import { GitHubAppError } from "#errors.ts";

export function signAppJwt(options: AppCredentials, now: number) {
	return Effect.try({
		catch: (cause) => new GitHubAppError({ reason: "sign" }, { cause }),
		try: () => {
			const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
			const payload = Buffer.from(JSON.stringify({ exp: now + 600, iat: now - 60, iss: options.appId })).toString("base64url");
			const input = `${header}.${payload}`;
			return Redacted.make(`${input}.${sign("RSA-SHA256", Buffer.from(input), Redacted.value(options.privateKey)).toString("base64url")}`);
		},
	});
}
