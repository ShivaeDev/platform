import { Effect } from "effect";
import type { AccountPreferenceValues } from "#accountPreferenceValues.ts";
import { AccountPreferenceRows } from "#server/account-preferences/Rows.ts";
import { providerFailure } from "#server/providerFailure.ts";

export const set = Effect.fn("AccountPreferencesStore.set")(function* (id: string, values: typeof AccountPreferenceValues.Type) {
	const repository = yield* AccountPreferenceRows;
	return yield* repository
		.upsert({ id, ...values }, { updateColumns: ["locale", "timezone", "units"] })
		.pipe(Effect.asVoid, Effect.catch(providerFailure));
});
