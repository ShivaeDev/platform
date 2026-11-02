import { Context } from "effect";
import type { DraftSession } from "./draftSession.ts";

export interface DraftStorage {
	readonly getItem: (key: string) => string | null;
	readonly removeItem: (key: string) => void;
	readonly setItem: (key: string, value: string) => void;
}

export class DraftStorageProvider extends Context.Service<DraftStorageProvider, () => DraftStorage>()("@shivaedev/form/DraftStorageProvider") {}

export interface PersistedDraftConfig {
	readonly key: string;
	readonly maxAgeMs?: number;
	readonly maxBytes?: number;
	readonly now: () => number;
	readonly session?: DraftSession | undefined;
	readonly storage: () => DraftStorage;
}

export interface Persistence<TValues> {
	readonly clear: () => void;
	readonly read: () => { readonly baseline: TValues; readonly edited: readonly string[]; readonly values: TValues } | undefined;
	readonly write: (baseline: TValues, values: TValues, edited: readonly string[]) => void;
}
