import { Effect, Schema } from "effect";
import { AccountPreferencesStore } from "#server/account-preferences/service.ts";

export const zone = Effect.fn("AccountClock.zone")(function* (account: string) {
	const { timezone } = yield* (yield* AccountPreferencesStore).get(account);
	// The store returns only timezones its row schema has checked, so a timezone that does not decode here is a broken invariant.
	return yield* Schema.decodeUnknownEffect(Schema.TimeZoneNamedFromString)(timezone).pipe(Effect.orDie);
});
