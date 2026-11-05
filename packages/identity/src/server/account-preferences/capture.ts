import { Effect } from "effect";
import type { AccountPreferenceValues } from "#accountPreferences.ts";
import { providerFailure } from "#server/providerFailure.ts";
import { AccountPreferenceRows } from "./Rows.ts";

export const capture = Effect.fn("AccountPreferencesStore.capture")(function* (id: string, values: typeof AccountPreferenceValues.Type) {
	const repository = yield* AccountPreferenceRows;
	return yield* repository.insertOrIgnore({ id, ...values }).pipe(Effect.asVoid, Effect.catch(providerFailure));
});
