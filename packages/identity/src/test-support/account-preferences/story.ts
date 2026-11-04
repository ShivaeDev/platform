import { DateTime, Effect } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as TestClock from "effect/testing/TestClock";
import { signedInUser } from "@shivaedev/test-kits/identity/adapters/betterAuth.ts";
import { databaseUrl, postgres } from "@shivaedev/test-sql/server/emptyPostgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { answered } from "@shivaedev/test-story/server/answers.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { AccountPreferenceValues } from "#accountPreferences.ts";
import { preferencesHost } from "./host.ts";

export const preferences = storyKit({
	around: withIsolatedDatabase,
	clock: Effect.runSync(DateTime.now),
	*create() {
		const host = yield* preferencesHost().pipe(Effect.provide(Reactivity.layer));
		const alice = yield* signedInUser(host.auth, { email: "alice@preferences.test", name: "alice" });
		const bob = yield* signedInUser(host.auth, { email: "bob@preferences.test", name: "bob" });
		return { accounts: { alice, bob }, host };
	},
	inspect: ({ host }) => ({ accounts: ["alice", "bob"], dayStart: host.config.dayStart }),
	layer: postgres,
	name: "account preferences",
	runIf: databaseUrl !== undefined,
	stages: ["preferences"],
	verbs: ({ accounts, host }, story) => ({
		capture: (values: typeof AccountPreferenceValues.Type) => {
			story.tell("alice captures her browser preferences");
			return host.client(accounts.alice.headers).pipe(
				Effect.flatMap((rpc) => rpc["identity.accountPreferences.capture"](values)),
				Effect.scoped,
			);
		},
		clockAt: (instant: string) => {
			story.tell(`the clock reaches ${instant}`);
			return TestClock.setTime(DateTime.toEpochMillis(DateTime.makeUnsafe(instant)));
		},
		day: () =>
			host.client(accounts.alice.headers).pipe(
				Effect.flatMap((rpc) => rpc["clock.day"]({})),
				Effect.scoped,
			),
		dayAt: (instant: string) =>
			host.client(accounts.alice.headers).pipe(
				Effect.flatMap((rpc) => rpc["clock.day"]({ instant: DateTime.makeUnsafe(instant) })),
				Effect.scoped,
			),
		get: (person: "alice" | "bob" = "alice") =>
			host.client(accounts[person].headers).pipe(
				Effect.flatMap((rpc) => rpc["identity.accountPreferences.get"]()),
				Effect.scoped,
			),
		range: (day: string) =>
			host.client(accounts.alice.headers).pipe(
				Effect.flatMap((rpc) => rpc["clock.range"]({ day })),
				Effect.map(({ start, end }) => ({ end: DateTime.formatIso(end), start: DateTime.formatIso(start) })),
				Effect.scoped,
			),
		set: (values: typeof AccountPreferenceValues.Type, person: "alice" | "bob" = "alice") => {
			story.tell(`${person} saves their preferences`);
			return host.client(accounts[person].headers).pipe(
				Effect.flatMap((rpc) => rpc["identity.accountPreferences.set"](values)),
				Effect.scoped,
			);
		},
		unsignedGet: () =>
			host.client(new Headers()).pipe(
				Effect.flatMap((rpc) => rpc["identity.accountPreferences.get"]()),
				Effect.scoped,
				answered,
			),
	}),
});

export const newYork = preferences.trait("preferences", "alice has New York preferences", ({ host, accounts }) =>
	host.client(accounts.alice.headers).pipe(
		Effect.flatMap((rpc) => rpc["identity.accountPreferences.set"]({ locale: "en-US", timezone: "America/New_York", units: "imperial" })),
		Effect.scoped,
	),
);

export const midnight = preferences.trait("preferences", "the application uses the default midnight day start", ({ host }) =>
	Effect.sync(() => {
		host.config.dayStart = undefined;
	}),
);

export function dayStartsAt(minutes: number) {
	return preferences.trait("preferences", `the application starts each day ${minutes} minutes after midnight`, ({ host }) =>
		Effect.sync(() => {
			host.config.dayStart = minutes;
		}),
	);
}
