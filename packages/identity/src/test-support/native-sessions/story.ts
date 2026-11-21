import { Effect } from "effect";
import { vi } from "vitest";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { storyClock, withIdentityDatabase } from "#test/clock.ts";
import { callers } from "#test/native-sessions/callers.ts";
import { diagnosticVerbs } from "#test/native-sessions/diagnosticVerbs.ts";
import { ANDROID_ORIGIN, type Host, NATIVE_ORIGIN, startHost } from "#test/native-sessions/host.ts";
import { mintAccounts } from "#test/native-sessions/mintAccounts.ts";
import type { Account } from "#test/native-sessions/requests.ts";
import { requestVerbs } from "#test/native-sessions/requestVerbs.ts";
import { shellVerbs } from "#test/native-sessions/shellVerbs.ts";
import { socketVerbs } from "#test/native-sessions/socketVerbs.ts";
import { sessionVerbs } from "#test/native-sessions/verbs.ts";
import { databaseUrl, postgres } from "#test/postgres.ts";

interface State {
	accountPreferences: boolean;
	readonly accounts: Map<string, Account>;
	enabled: boolean;
	host?: Host;
}

export const nativeSessions = storyKit({
	after: {
		*configured(state) {
			state.host = yield* startHost(state.enabled ? [NATIVE_ORIGIN, ANDROID_ORIGIN] : undefined, {
				accountPreferences: state.accountPreferences,
			});
		},
	},
	around: withIdentityDatabase,
	clock: storyClock,
	create: (): State => ({ accountPreferences: false, accounts: new Map(), enabled: true }),
	inspect: (state) => ({ accountPreferences: state.accountPreferences, accounts: [...state.accounts.keys()], enabled: state.enabled }),
	layer: postgres,
	name: "native bearer sessions through appHost",
	runIf: databaseUrl !== undefined,
	stages: ["configured", "accounts"],
	verbs: (state, story) => {
		const host = state.host;
		if (host === undefined) {
			throw new Error("The native session host has not started");
		}
		return {
			...socketVerbs(host, callers(state.accounts).account, story.tell),
			...diagnosticVerbs(host, state.accounts, story.tell),
			...requestVerbs(host, state.accounts, story.tell),
			...sessionVerbs(host, state.accounts, story.tell),
			...shellVerbs(host, state.accounts, story.tell),
		};
	},
});
export const cookieOnly = nativeSessions.trait("configured", "the default host keeps cookie-only sessions", (state) => {
	state.enabled = false;
});
export const capturesPreferences = nativeSessions.trait("configured", "the auth mount captures account preferences", (state) => {
	state.accountPreferences = true;
});
// A WebView or React Native shell has a global window; Node needs one so the plugin treats the shell as a client.
export function deviceIn(timezone: string) {
	return nativeSessions.trait("configured", `the shell runs in a WebView on a device set to ${timezone}`, function* () {
		vi.stubEnv("TZ", timezone);
		vi.stubGlobal("window", globalThis);
		yield* Effect.addFinalizer(() =>
			Effect.sync(() => {
				vi.unstubAllEnvs();
				vi.unstubAllGlobals();
			}),
		);
	});
}
export function signedIn(...names: string[]) {
	return accounts(names, false);
}

export function passwordAccount(name: string) {
	return accounts([name], true);
}

function accounts(names: readonly string[], password: boolean) {
	return nativeSessions.trait("accounts", "clients start with minted sessions", function* (state) {
		if (state.host === undefined) {
			return yield* Effect.die("The auth host has not started");
		}
		yield* mintAccounts(state.host, state.enabled, state.accounts, names, password);
	});
}
