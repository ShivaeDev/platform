import { Effect } from "effect";
import { defineService } from "@shivaedev/service/defineService.ts";
import { capture } from "./capture.ts";
import { get } from "./get.ts";
import { AccountPreferenceRows } from "./Rows.ts";
import { set } from "./set.ts";

export const AccountPreferencesStore = defineService({
	id: "@shivaedev/identity/AccountPreferencesStore",
	initialize: Effect.void,
	methods: () => ({ capture, get, set }),
	requires: [AccountPreferenceRows],
});
