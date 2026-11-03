import { Context, type Effect } from "effect";
import type { DraftSession } from "./draftSession.ts";

export type DraftOperation<A> = A | Effect.Effect<A, unknown>;

export interface DraftStorage {
	readonly getItem: (key: string) => DraftOperation<string | null>;
	readonly removeItem: (key: string, expected: string) => DraftOperation<void>;
	readonly setItem: (key: string, value: string, expected?: string) => DraftOperation<void>;
	readonly subscribe?: (key: string, listener: (value: string | null) => void) => () => void;
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

export interface StoredValues<TValues> {
	readonly baseline: TValues;
	readonly edited: readonly string[];
	readonly values: TValues;
}

export interface Persistence<TValues> {
	readonly clear: (revision?: string) => void;
	readonly observe: (receive: (values: StoredValues<TValues> | undefined) => boolean) => () => void;
	readonly revision: () => () => string | undefined;
	readonly write: (baseline: TValues, values: TValues, edited: readonly string[], sameInput?: boolean) => void;
}
