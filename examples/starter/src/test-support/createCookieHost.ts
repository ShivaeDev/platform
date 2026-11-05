import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { domFetch } from "@shivaedev/test-story/server/domFetch.ts";
import { makeAuth } from "#client/adapters/auth.ts";
import { type RunningHost, startHost } from "#test-support/host.ts";

export const createCookieHost = Effect.fn("CookieStory.createCookieHost")(function* (existing?: RunningHost) {
	const host = existing ?? (yield* startHost());
	const { baseUrl } = host;
	const previousLocation = window.location.href;
	const fetch = domFetch(baseUrl);
	yield* Effect.addFinalizer(() =>
		Effect.promise(async () => {
			try {
				const response = await fetch("/api/auth/sign-out", { body: "{}", headers: { "content-type": "application/json" }, method: "POST" });
				if (response.status !== HttpStatus.fromLiteral("OK")) {
					throw new Error(`Cookie cleanup sign-out failed: HTTP ${response.status}`);
				}
				await response.text();
			} finally {
				window.location.href = previousLocation;
			}
		}).pipe(Effect.timeout("5 seconds"), Effect.orDie),
	);
	return { ...host, auth: makeAuth({ baseUrl, fetchOptions: { customFetchImpl: fetch } }), fetch };
});
