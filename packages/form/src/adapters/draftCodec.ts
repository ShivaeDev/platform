import { Schema, SchemaParser } from "effect";
import type { PersistedDraftConfig, StoredValues } from "#persistence.ts";

export function draftCodec<TSchema extends Schema.Constraint>(schema: TSchema, config: PersistedDraftConfig) {
	const StoredDraft = Schema.Struct({
		baseline: Schema.Unknown,
		edited: Schema.Array(Schema.String),
		session: Schema.String,
		updatedAt: Schema.Number,
		values: Schema.Unknown,
		version: Schema.Literal(1),
	});
	const valid = Schema.is(StoredDraft);
	const decode = SchemaParser.decodeUnknownSync(Schema.toEncoded(schema), { disableChecks: true });
	const maxAgeMs = config.maxAgeMs ?? 7 * 24 * 60 * 60 * 1000;
	const maxBytes = config.maxBytes ?? 256 * 1024;
	const session = config.session?.id ?? "";
	function read(raw: string): StoredValues<TSchema["Encoded"]> {
		const value: unknown = new TextEncoder().encode(raw).byteLength <= maxBytes ? JSON.parse(raw) : undefined;
		const now = config.now();
		if (
			!valid(value)
			|| value.session !== session
			|| !Number.isFinite(maxAgeMs)
			|| !Number.isFinite(maxBytes)
			|| maxAgeMs <= 0
			|| maxBytes <= 0
			|| now - value.updatedAt > maxAgeMs
			|| value.updatedAt > now
		) {
			throw new Error("Invalid stored draft");
		}
		return { baseline: decode(value.baseline), edited: value.edited, values: decode(value.values) };
	}
	return {
		read,
		write: (baseline: TSchema["Encoded"], values: TSchema["Encoded"], edited: readonly string[]) => {
			const raw = JSON.stringify({ baseline, edited, revision: crypto.randomUUID(), session, updatedAt: config.now(), values, version: 1 });
			read(raw);
			return raw;
		},
	};
}
