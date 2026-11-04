import { SqlClient } from "effect/sql";
import { defineService } from "@shivaedev/service/defineService.ts";
import { capture } from "#server/account-preferences/capture.ts";
import { get } from "#server/account-preferences/get.ts";
import { initialize } from "#server/account-preferences/initialize.ts";
import { set } from "#server/account-preferences/set.ts";

export const AccountPreferencesStore = defineService({
	id: "@shivaedev/identity/AccountPreferencesStore",
	initialize,
	methods: (state) => ({ capture: capture(state), get: get(state), set: set(state) }),
	requires: [SqlClient.SqlClient],
});
