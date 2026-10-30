import { Schema, SchemaParser } from "effect";
import type { DraftSession } from "./draftSession.ts";

export interface DraftStorage {
	readonly getItem: (key: string) => string | null;
	readonly removeItem: (key: string) => void;
	readonly setItem: (key: string, value: string) => void;
}

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

export function persistence<TSchema extends Schema.Constraint>(schema: TSchema, config: PersistedDraftConfig): Persistence<TSchema["Encoded"]> {
	const encoded = Schema.toEncoded(schema);
	const StoredDraft = Schema.Struct({
		baseline: Schema.Unknown,
		edited: Schema.Array(Schema.String),
		session: Schema.String,
		updatedAt: Schema.Number,
		values: Schema.Unknown,
		version: Schema.Literal(1),
	});
	const valid = Schema.is(StoredDraft);
	const decode = SchemaParser.decodeUnknownSync(encoded, { disableChecks: true });
	const maxAgeMs = config.maxAgeMs ?? 7 * 24 * 60 * 60 * 1000;
	const maxBytes = config.maxBytes ?? 256 * 1024;
	function bytes(value: string) {
		return new TextEncoder().encode(value).byteLength;
	}
	const storage = config.storage;
	const session = config.session?.id ?? "";
	function active() {
		return config.session?.active !== false;
	}
	function attempt<A>(run: () => A, failed?: () => void): A | undefined {
		try {
			return run();
		} catch {
			failed?.();
			return undefined;
		}
	}
	function clear() {
		attempt(() => storage().removeItem(config.key));
	}
	config.session?.track(config.key, clear);
	return {
		clear: () => {
			if (active()) {
				clear();
			}
		},
		read: () =>
			attempt(() => {
				if (!active()) {
					return undefined;
				}
				const raw = storage().getItem(config.key);
				if (raw === null) {
					return undefined;
				}
				const value: unknown = bytes(raw) <= maxBytes ? JSON.parse(raw) : undefined;
				const now = config.now();
				if (
					valid(value)
					&& value.session === session
					&& Number.isFinite(maxAgeMs)
					&& Number.isFinite(maxBytes)
					&& maxAgeMs > 0
					&& maxBytes > 0
					&& now - value.updatedAt <= maxAgeMs
					&& value.updatedAt <= now
				) {
					return { baseline: decode(value.baseline), edited: value.edited, values: decode(value.values) };
				}
				clear();
				return undefined;
			}, clear),
		write: (baseline, values, edited) => {
			if (!active()) {
				return;
			}
			attempt(() => {
				const raw = JSON.stringify({ baseline, edited, session, updatedAt: config.now(), values, version: 1 });
				const parsed: unknown = JSON.parse(raw);
				if (!(maxAgeMs > 0 && Number.isFinite(maxAgeMs) && Number.isFinite(maxBytes) && bytes(raw) <= maxBytes && valid(parsed))) {
					clear();
					return;
				}
				decode(parsed.baseline);
				decode(parsed.values);
				storage().setItem(config.key, raw);
			}, clear);
		},
	};
}
