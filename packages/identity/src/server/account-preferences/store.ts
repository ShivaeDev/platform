import { Layer } from "effect";
import { AccountPreferenceRows } from "#server/account-preferences/Rows.ts";
import { AccountPreferencesStore } from "#server/account-preferences/service.ts";

export const accountPreferencesStore = AccountPreferencesStore.layer.pipe(Layer.provide(AccountPreferenceRows.layer));
