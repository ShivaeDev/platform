import { Effect } from "effect";
import type { AccountPreferenceValues } from "#accountPreferences.ts";
import { providerFailure } from "#server/providerFailure.ts";
import type { PreferencesRepository } from "./initialize.ts";

export function set(repository: PreferencesRepository) {
	return Effect.fnUntraced(function* (id: string, values: typeof AccountPreferenceValues.Type) {
		return yield* repository
			.upsert({ id, ...values }, { updateColumns: ["locale", "timezone", "units"] })
			.pipe(Effect.asVoid, Effect.catch(providerFailure));
	});
}
