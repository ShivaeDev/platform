import { createAuthClient } from "better-auth/client";
import { Effect } from "effect";
import { domFetch } from "@shivaedev/test-story/server/domFetch.ts";
import { routeOutbound } from "@shivaedev/test-story/server/routeOutbound.ts";
import { oauthProvider } from "./oauthProvider.ts";
import { socialHost } from "./socialHost.ts";

export const socialEngine = Effect.fn("SocialStory.socialEngine")(function* () {
	const provider = yield* oauthProvider();
	yield* routeOutbound({ "api.github.com": provider.url, "github.com": provider.url });
	const host = yield* socialHost();
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
