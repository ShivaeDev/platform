import { Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { SqlClient } from "effect/sql";
import { defineService } from "@shivaedev/service/defineService.ts";
import { makeRepository } from "@shivaedev/sql/repository.ts";
import { AccountPreferenceValues } from "#accountPreferences.ts";
import { providerFailure } from "#server/providerFailure.ts";

class StoredPreferences extends Model.Class<StoredPreferences>("AccountPreferences")({
	id: Schema.String,
	...AccountPreferenceValues.fields,
}) {}

export const AccountPreferencesStore = defineService({
	id: "@shivaedev/identity/AccountPreferencesStore",
	initialize: makeRepository(StoredPreferences, {
		conflictColumns: ["id"],
		idColumn: "id",
		spanPrefix: "AccountPreferences",
		tableName: "identity_account_preferences",
	}),
	methods: (repository) => ({
		capture: (id: string, values: typeof AccountPreferenceValues.Type) =>
			repository.insertOrIgnore({ id, ...values }).pipe(Effect.asVoid, Effect.catch(providerFailure)),
		get: (id: string) =>
			repository.findById(id).pipe(
				Effect.map(({ locale, timezone, units }) => ({ locale, timezone, units })),
				Effect.catchTag("NoSuchElementError", () => Effect.succeed({ locale: "en", timezone: "UTC", units: "metric" as const })),
				Effect.catch(providerFailure),
			),
		set: (id: string, values: typeof AccountPreferenceValues.Type) =>
			repository.upsert({ id, ...values }, { updateColumns: ["locale", "timezone", "units"] }).pipe(Effect.asVoid, Effect.catch(providerFailure)),
	}),
	requires: [SqlClient.SqlClient],
});
