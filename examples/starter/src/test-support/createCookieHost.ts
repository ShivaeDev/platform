import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { domFetch } from "@shivaedev/test-story/server/domFetch.ts";
import { makeAuth } from "#client/adapters/auth.ts";
import { type RunningHost, startHost } from "#test-support/host.ts";
import { sessionRequests } from "#test-support/sessionRequests.ts";

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
	const checks = sessionRequests(fetch);
	const auth = makeAuth({ baseUrl, fetchOptions: { customFetchImpl: checks.fetch } });
	return { ...host, auth, fetch, sessionPending: (registry: AtomRegistry.AtomRegistry) => checks.pending(registry, auth.session.atom) };
});
