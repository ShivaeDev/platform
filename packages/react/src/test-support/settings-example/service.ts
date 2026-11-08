import { Effect } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { Identity } from "@shivaedev/identity/identity.ts";
import { defineService } from "@shivaedev/service/defineService.ts";
import { get } from "#test/settings-example/get.ts";
import { EntitiesRepository, SettingsRepository } from "#test/settings-example/repository.ts";
import { save } from "#test/settings-example/save.ts";

export const SettingsService = defineService({
	id: "@shivaedev/react/settings-example/SettingsService",
	initialize: Effect.void,
	methods: () => ({ get, save }),
	requires: [Identity, EntitiesRepository, SettingsRepository, SqlClient.SqlClient, Reactivity.Reactivity],
});
