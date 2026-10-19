import { Effect } from "effect";
import { domFetch } from "@shivaedev/test-story/server/domFetch.ts";
import { makeAuth } from "#client/auth.ts";
import { startHost } from "#test-support/host.ts";

export const createCookieHost = Effect.fn("CookieStory.createCookieHost")(function* () {
	const { baseUrl } = yield* startHost();
	const previousLocation = window.location.href;
	const fetch = domFetch(baseUrl);
	yield* Effect.addFinalizer(() =>
		Effect.promise(async () => {
			try {
				const response = await fetch("/api/auth/sign-out", { body: "{}", headers: { "content-type": "application/json" }, method: "POST" });
				if (response.status !== 200) {
					throw new Error(`Cookie cleanup sign-out failed: HTTP ${response.status}`);
				}
				await response.text();
			} finally {
				window.location.href = previousLocation;
			}
		}).pipe(Effect.timeout("5 seconds"), Effect.orDie),
	);
	return { auth: makeAuth({ baseUrl, fetchOptions: { customFetchImpl: fetch } }), baseUrl, fetch };
});
