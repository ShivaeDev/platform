import { Effect, Schema } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { schemaFieldKeys } from "@shivaedev/errors/schemaFieldScope.ts";
import { marked } from "@shivaedev/errors/schemaSensitiveAst.ts";
import type { QueryShape } from "#operation.ts";
import type { QueryStorage, StoredQuery } from "#QueryStorage.ts";

export interface OpenedQueryStorage {
	readonly entries: readonly StoredQuery[];
	readonly storage: QueryStorage;
	readonly user: string;
}

// An operation's schemas may need services, so each step is an Effect that the query runtime's services run.
export interface StoredForm<A> {
	readonly decode: (raw: string) => Effect.Effect<A, Schema.SchemaError, unknown>;
	readonly encode: (value: A) => Effect.Effect<string, Schema.SchemaError, unknown>;
	readonly key: Effect.Effect<string, Schema.SchemaError, unknown>;
}

export const storedQueries = Atom.keepAlive(Atom.make<OpenedQueryStorage | undefined>(undefined));

function carriesSensitivityMark(schema: Schema.Top) {
	return marked(schema.ast) || schemaFieldKeys(schema.ast, []).size > 0;
}

function jsonText<TSchema extends Schema.Top>(schema: TSchema) {
	return Schema.fromJsonString(Schema.toCodecJson(schema));
}

export function storedForm(tag: string, query: QueryShape) {
	if (carriesSensitivityMark(query.success)) {
		return () => undefined;
	}
	const payload = Schema.encodeUnknownEffect(jsonText(query.payload));
	const decode = Schema.decodeUnknownEffect(jsonText(query.success));
	const encode = Schema.encodeUnknownEffect(jsonText(query.success));
	return (value: unknown, subject: string | undefined): StoredForm<unknown> => ({
		decode,
		encode,
		key: Effect.map(payload(value), (encoded) => JSON.stringify([tag, encoded, subject ?? null])),
	});
}
