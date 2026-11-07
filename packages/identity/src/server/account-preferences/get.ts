import { Effect } from "effect";
import { AccountPreferenceRows } from "#server/account-preferences/Rows.ts";
import { providerFailure } from "#server/providerFailure.ts";

export const get = Effect.fn("AccountPreferencesStore.get")(function* (id: string) {
	const repository = yield* AccountPreferenceRows;
	return yield* repository.findById(id).pipe(
		Effect.map(({ locale, timezone, units }) => ({ locale, timezone, units })),
		Effect.catchTag("NoSuchElementError", () => Effect.succeed({ locale: "en", timezone: "UTC", units: "metric" as const })),
		Effect.catch(providerFailure),
	);
});
