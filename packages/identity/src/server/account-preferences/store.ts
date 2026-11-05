import { Layer } from "effect";
import { AccountPreferenceRows } from "./Rows.ts";
import { AccountPreferencesStore } from "./service.ts";

export const accountPreferencesStore = AccountPreferencesStore.layer.pipe(Layer.provide(AccountPreferenceRows.layer));
