import { Effect } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { defineService } from "@shivaedev/service/defineService.ts";
import { get } from "./get.ts";
import { EntitiesRepository, SettingsRepository } from "./repository.ts";
import { save } from "./save.ts";

export const SettingsService = defineService({
	id: "@shivaedev/react/settings-example/Service",
	initialize: Effect.void,
	methods: () => ({ get, save }),
	requires: [EntitiesRepository, SettingsRepository, SqlClient.SqlClient, Reactivity.Reactivity],
});
