import { Effect } from "effect";
import { expect } from "vitest";
import { domFetch } from "@shivaedev/test-story/domFetch.ts";
import { makeAuth } from "#client/auth.ts";
import { startHost } from "./host.ts";

export const createCookieHost = Effect.fn("CookieStory.createCookieHost")(function* () {
	const { baseUrl } = yield* startHost();
	const previousLocation = window.location.href;
	const fetch = domFetch(baseUrl);
	yield* Effect.addFinalizer(() =>
		Effect.promise(async () => {
			try {
				const response = await fetch("/api/auth/sign-out", { body: "{}", headers: { "content-type": "application/json" }, method: "POST" });
				expect(response.status).toBe(200);
				await response.text();
			} finally {
				window.location.href = previousLocation;
			}
		}).pipe(Effect.timeout("5 seconds"), Effect.orDie),
	);
	return { auth: makeAuth({ baseUrl, fetchOptions: { customFetchImpl: fetch } }), baseUrl, fetch };
});
