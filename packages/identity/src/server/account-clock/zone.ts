import { Effect, Schema } from "effect";
import { AccountPreferencesStore } from "#server/account-preferences/service.ts";

export const zone = Effect.fn("AccountClock.zone")(function* (account: string) {
	const { timezone } = yield* (yield* AccountPreferencesStore).get(account);
	return yield* Schema.decodeUnknownEffect(Schema.TimeZoneNamedFromString)(timezone);
});
