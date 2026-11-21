import { DateTime, Effect } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as TestClock from "effect/testing/TestClock";
import { signedInUser } from "@shivaedev/test-kits/identity/adapters/betterAuth.ts";
import { answered } from "@shivaedev/test-story/server/answers.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { AccountPreferenceValues } from "#accountPreferenceValues.ts";
import { AccountClock } from "#server/account-clock/service.ts";
import { type PreferencesHost, preferencesHost } from "#test/account-preferences/host.ts";
import { storyClock, withIdentityDatabase } from "#test/clock.ts";
import { databaseUrl, postgres } from "#test/postgres.ts";

type Person = "alice" | "bob";

interface State {
	dayStart: number | undefined;
	started?: Effect.Success<ReturnType<typeof start>>;
}

const start = Effect.fnUntraced(function* (dayStart: number | undefined) {
	const host: PreferencesHost = yield* preferencesHost(dayStart).pipe(Effect.provide(Reactivity.layer));
	const alice = yield* signedInUser(host.auth, { email: "alice@preferences.test", name: "alice" });
	const bob = yield* signedInUser(host.auth, { email: "bob@preferences.test", name: "bob" });
	return { accounts: { alice, bob }, host };
});

function started(state: State) {
	if (state.started === undefined) {
		throw new Error("The host has not started");
	}
	return state.started;
}

export const preferences = storyKit({
	after: {
		*configured(state) {
			state.started = yield* start(state.dayStart);
		},
	},
	around: withIdentityDatabase,
	clock: storyClock,
	create: (): State => ({ dayStart: 240 }),
	inspect: (state) => ({ accounts: ["alice", "bob"], dayStart: state.dayStart }),
	layer: postgres,
	name: "account preferences",
	runIf: databaseUrl !== undefined,
	stages: ["configured", "preferences"],
	verbs: (state, story) => {
		const { accounts, host } = started(state);
		function id(person: Person) {
			return accounts[person].user.id;
		}
		return {
			backgroundDay: (person: Person, instant: string) => {
				story.tell(`a program outside any request reads ${person}'s day`);
				return host.background(Effect.flatMap(AccountClock, (clock) => clock.logicalDay(id(person), DateTime.makeUnsafe(instant))));
			},
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
			days: (instant: string) => {
				story.tell("alice asks in one request for alice's and bob's days");
				return host.client(accounts.alice.headers).pipe(
					Effect.flatMap((rpc) => rpc["clock.days"]({ accounts: [id("alice"), id("bob")], instant: DateTime.makeUnsafe(instant) })),
					Effect.map(([alice, bob]) => ({ alice, bob })),
					Effect.scoped,
				);
			},
			get: (person: Person = "alice") =>
				host.client(accounts[person].headers).pipe(
					Effect.flatMap((rpc) => rpc["identity.accountPreferences.get"]()),
					Effect.scoped,
				),
			range: (day: string) =>
				host.client(accounts.alice.headers).pipe(
					Effect.flatMap((rpc) => rpc["clock.range"]({ day })),
					Effect.map(({ start: from, end }) => ({ end: DateTime.formatIso(end), start: DateTime.formatIso(from) })),
					Effect.scoped,
				),
			reportDay: (person: Person, instant: string) => {
				story.tell(`a report that declares no subject reads ${person}'s day`);
				return host.client(new Headers()).pipe(
					Effect.flatMap((rpc) => rpc["report.day"]({ account: id(person), instant: DateTime.makeUnsafe(instant) })),
					Effect.scoped,
				);
			},
			set: (values: typeof AccountPreferenceValues.Type, person: Person = "alice") => {
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
		};
	},
});

function savedPreferences(person: Person, line: string, values: typeof AccountPreferenceValues.Type) {
	return preferences.trait("preferences", line, (state) => {
		const { accounts, host } = started(state);
		return host.client(accounts[person].headers).pipe(
			Effect.flatMap((rpc) => rpc["identity.accountPreferences.set"](values)),
			Effect.scoped,
		);
	});
}

export const newYork = savedPreferences("alice", "alice has New York preferences", {
	locale: "en-US",
	timezone: "America/New_York",
	units: "imperial",
});

export const bobInTokyo = savedPreferences("bob", "bob has Tokyo preferences", { locale: "ja-JP", timezone: "Asia/Tokyo", units: "metric" });

export const midnight = preferences.trait("configured", "the application uses the default midnight day start", (state) => {
	state.dayStart = undefined;
});

export function dayStartsAt(minutes: number) {
	return preferences.trait("configured", `the application starts each day ${minutes} minutes after midnight`, (state) => {
		state.dayStart = minutes;
	});
}
