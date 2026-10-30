import { Effect } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { databaseUrl, postgres } from "@shivaedev/test-sql/server/emptyPostgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { mintSessions } from "./fixtures.ts";
import { sessionAdminHost } from "./host.ts";
import { sessionAdminVerbs } from "./verbs.ts";

export const sessionAdmin = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const host = yield* sessionAdminHost().pipe(Effect.provide(Reactivity.layer));
		return { accounts: yield* mintSessions(host), host };
	},
	inspect: ({ accounts }) => ({ sessions: Object.keys(accounts) }),
	layer: postgres,
	name: "session administration",
	runIf: databaseUrl !== undefined,
	stages: ["storage"],
	verbs: sessionAdminVerbs,
});

export const expiredPhone = sessionAdmin.trait("storage", "bob's phone session has expired", function* ({ accounts, host }) {
	const context = yield* Effect.promise(() => host.auth.$context);
	yield* Effect.promise(() => context.internalAdapter.updateSession(accounts.bobPhone.token, { expiresAt: new Date("2000-01-01") }));
});

export const tiedActivity = sessionAdmin.trait("storage", "bob's two sessions have the same last activity", function* ({ accounts, host }) {
	const context = yield* Effect.promise(() => host.auth.$context);
	yield* Effect.promise(() => context.internalAdapter.updateSession(accounts.bobPhone.token, { updatedAt: new Date("2026-01-03") }));
});
