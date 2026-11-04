import { Effect } from "effect";
import { databaseUrl, postgres } from "@shivaedev/test-sql/server/emptyPostgres.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { storyClock, withIdentityDatabase } from "#test/clock.ts";
import { callers } from "./callers.ts";
import { diagnosticVerbs } from "./diagnosticVerbs.ts";
import { type Host, NATIVE_ORIGIN, startHost } from "./host.ts";
import { mintAccounts } from "./mintAccounts.ts";
import type { Account } from "./requests.ts";
import { requestVerbs } from "./requestVerbs.ts";
import { socketVerbs } from "./socketVerbs.ts";
import { sessionVerbs } from "./verbs.ts";

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
