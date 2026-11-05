import { createAuthClient } from "better-auth/client";
import { Effect } from "effect";
import { fakeOauthProvider } from "@shivaedev/test-kits/identity/oauth.ts";
import { domFetch } from "@shivaedev/test-story/server/domFetch.ts";
import { routeOutbound } from "@shivaedev/test-story/server/routeOutbound.ts";
import { socialHost } from "./socialHost.ts";

export const socialEngine = Effect.fn("SocialStory.socialEngine")(function* () {
	const provider = yield* fakeOauthProvider();
	yield* routeOutbound({ "api.github.com": provider.server.url, "github.com": provider.server.url });
	const host = yield* socialHost(provider.discoveryUrl);
	const previousLocation = window.location.href;
	yield* Effect.addFinalizer(() =>
		Effect.sync(() => {
			window.location.href = previousLocation;
		}),
	);
	const fetch = domFetch(host.baseUrl);
	const client = createAuthClient({ "baseURL": host.baseUrl, fetchOptions: { customFetchImpl: fetch } });
	return { ...host, client, fetch, minted: new Map<string, string>(), provider };
});
