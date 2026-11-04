import { Duration, Effect } from "effect";
import { type FakeHttpRequest, type FakeHttpRoute, fakeHttpService } from "@shivaedev/test-story/server/fakeHttpService.ts";
import { oauthProtocol } from "#identity/adapters/oauthProtocol.ts";

export interface OauthProfile {
	readonly email: string;
	readonly emailVerified?: boolean;
	readonly name: string;
	readonly sub: string;
}

export interface FakeOauthOptions {
	readonly clientId?: string;
	readonly clientSecret?: string;
	readonly codeLifetime?: Duration.Input;
	readonly profile?: OauthProfile | ((request: FakeHttpRequest) => OauthProfile);
	readonly routes?: Readonly<Record<string, FakeHttpRoute>>;
}

export const fakeOauthProvider = Effect.fnUntraced(function* (options: FakeOauthOptions = {}) {
	const credentials = { clientId: options.clientId ?? "story-client", clientSecret: options.clientSecret ?? "story-secret" };
	const protocol = yield* oauthProtocol({
		...credentials,
		codeLifetime: Duration.toMillis(options.codeLifetime ?? "1 minute"),
		profile: options.profile ?? { email: "alice@social.test", name: "Alice", sub: "123" },
	});
	const server = yield* fakeHttpService({ routes: { ...protocol.routes, ...options.routes } });
	protocol.issuer(server.url);
	return {
		credentials,
		discoveryUrl: `${server.url}/.well-known/openid-configuration`,
		refuseConsent: () => Effect.sync(() => protocol.consent(false)),
		server,
	};
});
