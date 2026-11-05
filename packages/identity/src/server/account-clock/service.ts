import { defineService } from "@shivaedev/service/defineService.ts";
import { AccountPreferencesStore } from "#server/account-preferences/service.ts";
import { Subject } from "#subject.ts";
import { dayRange } from "./dayRange.ts";
import { initialize } from "./initialize.ts";
import { logicalDay } from "./logicalDay.ts";
import { AccountDayStart } from "./settings.ts";

export const AccountClock = defineService({
	id: "@shivaedev/identity/AccountClock",
	initialize,
	methods: (state) => ({ dayRange: dayRange(state), logicalDay: logicalDay(state) }),
	requires: [AccountPreferencesStore, Subject, AccountDayStart],
});
