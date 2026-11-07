import { defineService } from "@shivaedev/service/adapters/defineService.ts";
import { dayRange } from "#server/account-clock/dayRange.ts";
import { initialize } from "#server/account-clock/initialize.ts";
import { logicalDay } from "#server/account-clock/logicalDay.ts";
import { AccountDayStart } from "#server/account-clock/settings.ts";
import { AccountPreferencesStore } from "#server/account-preferences/service.ts";
import { Subject } from "#subject.ts";

export const AccountClock = defineService({
	id: "@shivaedev/identity/AccountClock",
	initialize,
	methods: (state) => ({ dayRange: dayRange(state), logicalDay: logicalDay(state) }),
	requires: [AccountPreferencesStore, Subject, AccountDayStart],
});
