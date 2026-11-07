import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { storyClock, withIdentityDatabase } from "#test/clock.ts";
import { callers } from "#test/native-sessions/callers.ts";
import { diagnosticVerbs } from "#test/native-sessions/diagnosticVerbs.ts";
import { type Host, NATIVE_ORIGIN, startHost } from "#test/native-sessions/host.ts";
import { mintAccounts } from "#test/native-sessions/mintAccounts.ts";
import type { Account } from "#test/native-sessions/requests.ts";
import { requestVerbs } from "#test/native-sessions/requestVerbs.ts";
import { socketVerbs } from "#test/native-sessions/socketVerbs.ts";
import { sessionVerbs } from "#test/native-sessions/verbs.ts";
import { databaseUrl, postgres } from "#test/postgres.ts";

interface State {
	readonly accounts: Map<string, Account>;
	enabled: boolean;
	host?: Host;
	nativeOrigins?: readonly string[];
}

export const nativeSessions = storyKit({
	after: {
		*configured(state) {
			state.host = yield* startHost(state.enabled, state.nativeOrigins);
		},
	},
	around: withIdentityDatabase,
	clock: storyClock,
	create: (): State => ({ accounts: new Map(), enabled: true }),
	inspect: (state) => ({ accounts: [...state.accounts.keys()], enabled: state.enabled }),
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
		};
	},
});
export const cookieOnly = nativeSessions.trait("configured", "the default host keeps cookie-only sessions", (state) => {
	state.enabled = false;
});
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

export const nativeTransport = nativeSessions.trait("configured", "the host admits the bundled WebView origin", (state) => {
	state.nativeOrigins = [NATIVE_ORIGIN];
});
