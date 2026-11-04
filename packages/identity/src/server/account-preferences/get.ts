import { Effect } from "effect";
import { providerFailure } from "#server/providerFailure.ts";
import type { PreferencesRepository } from "./initialize.ts";

export function get(repository: PreferencesRepository) {
	return Effect.fnUntraced(function* (id: string) {
		return yield* repository.findById(id).pipe(
			Effect.map(({ locale, timezone, units }) => ({ locale, timezone, units })),
			Effect.catchTag("NoSuchElementError", () => Effect.succeed({ locale: "en", timezone: "UTC", units: "metric" as const })),
			Effect.catch(providerFailure),
		);
	});
}
