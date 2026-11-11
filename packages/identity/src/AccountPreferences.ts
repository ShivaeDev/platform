import { defineModule } from "@shivaedev/contract/defineModule.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { AccountPreferenceValues, accountPreferenceKeys } from "#accountPreferenceValues.ts";
import { identityAccountPreferencesWire } from "#generated/AccountPreferences.ts";
import { AccountPreferencesStore } from "#server/account-preferences/service.ts";
import { Subject, selfSubject } from "#subject.ts";

const GetPreferences = query("get", {
	reads: () => [accountPreferenceKeys.list],
	*run() {
		const { id } = yield* Subject;
		return yield* (yield* AccountPreferencesStore).get(id);
	},
});

const SetPreferences = command("set", {
	invalidates: () => [accountPreferenceKeys.list],
	payload: AccountPreferenceValues.fields,
	*run(values) {
		const { id } = yield* Subject;
		yield* (yield* AccountPreferencesStore).set(id, values);
	},
});

const CapturePreferences = command("capture", {
	invalidates: () => [accountPreferenceKeys.list],
	payload: AccountPreferenceValues.fields,
	*run(values) {
		const { id } = yield* Subject;
		yield* (yield* AccountPreferencesStore).capture(id, values);
	},
});

export const AccountPreferences = defineModule({
	name: "identity.accountPreferences",
	operations: [GetPreferences, SetPreferences, CapturePreferences],
	requires: [AccountPreferencesStore],
	subject: selfSubject,
	wire: identityAccountPreferencesWire,
});
