import { Schema } from "effect";
import { Model } from "effect/schema";
import { defineRepository } from "@shivaedev/sql/defineRepository.ts";
import { makeRepository } from "@shivaedev/sql/repository.ts";
import { AccountPreferenceValues } from "#accountPreferences.ts";

class StoredPreferences extends Model.Class<StoredPreferences>("AccountPreferences")({
	id: Schema.String,
	...AccountPreferenceValues.fields,
}) {}

const initialize = makeRepository(StoredPreferences, {
	conflictColumns: ["id"],
	idColumn: "id",
	spanPrefix: "AccountPreferences",
	tableName: "identity_account_preferences",
});

export const AccountPreferenceRows = defineRepository({
	id: "@shivaedev/identity/AccountPreferenceRows",
	initialize,
});
