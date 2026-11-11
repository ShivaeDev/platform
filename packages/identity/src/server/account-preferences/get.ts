import { Effect } from "effect";
import type { AccountPreferenceValues } from "#accountPreferenceValues.ts";
import { AccountPreferenceRows } from "#server/account-preferences/Rows.ts";
import { providerFailure } from "#server/providerFailure.ts";

const DEFAULTS: typeof AccountPreferenceValues.Type = { locale: "en", timezone: "UTC", units: "metric" };

export const get = Effect.fn("AccountPreferencesStore.get")(function* (id: string) {
	const repository = yield* AccountPreferenceRows;
	return yield* repository.findById(id).pipe(
		Effect.map(({ locale, timezone, units }): typeof AccountPreferenceValues.Type => ({ locale, timezone, units })),
		Effect.catchTag("NoSuchElementError", () => Effect.succeed(DEFAULTS)),
		Effect.catch(providerFailure),
	);
});
