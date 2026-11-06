import { createAuthClient } from "better-auth/client";
import { Effect } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { vi } from "vitest";
import { passwordUser, signInAgain } from "@shivaedev/test-kits/identity/adapters/betterAuth.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { preferencesClient } from "#server/better-auth/adapters/preferencesClient.ts";
import { storyClock, withIdentityDatabase } from "#test/clock.ts";
import { CURRENT_PASSWORD, PASSWORD_HASH } from "#test/passwords.ts";
import { databaseUrl, postgres } from "#test/postgres.ts";
import { ORIGIN, preferencesHost } from "./host.ts";

export const browserPreferences = storyKit({
	around: withIdentityDatabase,
	clock: storyClock,
	*create() {
		vi.stubEnv("TZ", "America/New_York");
		yield* Effect.addFinalizer(() => Effect.sync(() => vi.unstubAllEnvs()));
		const host = yield* preferencesHost().pipe(Effect.provide(Reactivity.layer));
		const alice = yield* passwordUser(host.auth, { email: "alice@browser.test", name: "alice", passwordHash: PASSWORD_HASH });
		const defaults = new Intl.DateTimeFormat().resolvedOptions();
		let cookie = "";
		const client = createAuthClient({
			"baseURL": ORIGIN,
			fetchOptions: {
				customFetchImpl: async (input, init) => {
					const headers = new Headers(init?.headers);
					headers.set("cookie", cookie);
					const response = await host.fetch(input, { ...init, headers });
					const cookies = response.headers.getSetCookie();
					if (cookies.length > 0) {
						cookie = cookies.map((value) => value.split(";")[0]).join("; ");
					}
					return response;
				},
			},
			plugins: [preferencesClient()],
		});
		return {
			alice,
			client,
			defaults,
			headers: () => new Headers({ cookie }),
			host,
			useSession: (headers: Headers) => {
				cookie = headers.get("cookie") ?? "";
			},
		};
	},
	inspect: ({ defaults }) => ({ browser: { locale: defaults.locale, timezone: defaults.timeZone } }),
	layer: postgres,
	name: "browser account preferences",
	runIf: databaseUrl !== undefined,
	stages: ["session"],
	verbs: ({ alice, client, defaults, headers, host }, story) => ({
		browserDefaults: () => Effect.succeed({ locale: defaults.locale, timezone: defaults.timeZone, units: "metric" }),
		get: () =>
			host.client(headers()).pipe(
				Effect.flatMap((rpc) => rpc["identity.accountPreferences.get"]()),
				Effect.scoped,
			),
		session: () => {
			story.tell("the browser reads alice's existing session");
			return Effect.promise(() => client.getSession()).pipe(Effect.map(({ data, error }) => error?.code ?? data?.user.name));
		},
		setTimezone: (timezone: string) => {
			story.tell(`alice saves ${timezone} as her timezone`);
			return host.client(headers()).pipe(
				Effect.flatMap((rpc) => rpc["identity.accountPreferences.set"]({ locale: "en-GB", timezone, units: "imperial" })),
				Effect.scoped,
			);
		},
		signIn: () => {
			story.tell("alice signs in with the browser client");
			return Effect.promise(() => client.signIn.email({ email: alice.email, password: CURRENT_PASSWORD })).pipe(
				Effect.map(({ error }) => error?.code ?? "signed in"),
			);
		},
	}),
});

export const mintedBrowserSession = browserPreferences.trait(
	"session",
	"alice has a session minted without browser preferences",
	function* ({ alice, host, useSession }) {
		const session = yield* signInAgain(host.auth, alice.id);
		useSession(session.headers);
	},
);
