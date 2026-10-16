import { Effect, type Redacted } from "effect";
import { credentials } from "./authHttp.ts";
import { forwardingProxy } from "./forwardingProxy.ts";
import { productionAuth } from "./productionAuth.ts";

export const authRateLimits = Effect.fn("StarterStory.authRateLimits")(function* (
	databaseUrl: Redacted.Redacted<string>,
	trustedProxy: string | undefined,
	tell: (line: string) => void,
) {
	const host = yield* productionAuth(databaseUrl, trustedProxy);
	return {
		output: host.output,
		visitor: Effect.fn("StarterStory.visitor")(function* (clientIp: string) {
			tell(`a visitor connects through a proxy forwarding ${clientIp}`);
			const proxy = yield* Effect.acquireRelease(
				Effect.promise(() => forwardingProxy(host.url, clientIp)),
				(fixture) => Effect.promise(() => fixture.close()),
			);
			return {
				signIn: Effect.fn("StarterStory.signIn")(function* () {
					tell(`the visitor at ${clientIp} attempts sign-in`);
					return yield* Effect.promise(async () => {
						const response = await fetch(`${proxy.url}/api/auth/sign-in/email`, {
							body: JSON.stringify(credentials("unknown")),
							headers: { "content-type": "application/json", origin: "https://app.example" },
							method: "POST",
						});
						await response.text();
						return response.status;
					});
				}),
			};
		}),
	};
});
