import { Effect } from "effect";
import { AccountPreferences } from "#accountPreferences.ts";
import { AccountPreferencesStore } from "#server/account-preferences/service.ts";
import { Subject } from "#subject.ts";

export const accountPreferencesHandlers = AccountPreferences.application.toLayer({
	"identity.accountPreferences.capture": (values) =>
		Effect.gen(function* () {
			const { id } = yield* Subject;
			return yield* (yield* AccountPreferencesStore).capture(id, values);
		}),
	"identity.accountPreferences.get": () =>
		Effect.gen(function* () {
			const { id } = yield* Subject;
			return yield* (yield* AccountPreferencesStore).get(id);
		}),
	"identity.accountPreferences.set": (values) =>
		Effect.gen(function* () {
			const { id } = yield* Subject;
			return yield* (yield* AccountPreferencesStore).set(id, values);
		}),
});
