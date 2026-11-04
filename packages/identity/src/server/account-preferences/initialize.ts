import { type Effect, Schema } from "effect";
import { Model } from "effect/schema";
import { makeRepository } from "@shivaedev/sql/repository.ts";
import { AccountPreferenceValues } from "#accountPreferences.ts";

class StoredPreferences extends Model.Class<StoredPreferences>("AccountPreferences")({
	id: Schema.String,
	...AccountPreferenceValues.fields,
}) {}

export const initialize = makeRepository(StoredPreferences, {
	conflictColumns: ["id"],
	idColumn: "id",
	spanPrefix: "AccountPreferences",
	tableName: "identity_account_preferences",
});

export type PreferencesRepository = Effect.Success<typeof initialize>;
