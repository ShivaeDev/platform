import { Effect } from "effect";
import { defineService } from "@shivaedev/service/adapters/defineService.ts";
import { capture } from "#server/account-preferences/capture.ts";
import { get } from "#server/account-preferences/get.ts";
import { AccountPreferenceRows } from "#server/account-preferences/Rows.ts";
import { set } from "#server/account-preferences/set.ts";

export const AccountPreferencesStore = defineService({
	id: "@shivaedev/identity/AccountPreferencesStore",
	initialize: Effect.void,
	methods: () => ({ capture, get, set }),
	requires: [AccountPreferenceRows],
});
