import { Option, Schema } from "effect";
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

export interface StoredForm<A> {
	readonly decode: (raw: string) => Option.Option<A>;
	readonly encode: (value: A) => Option.Option<string>;
	readonly key: string;
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
	const payload = Schema.encodeUnknownOption(jsonText(query.payload));
	const decode = Schema.decodeUnknownOption(jsonText(query.success));
	const encode = Schema.encodeUnknownOption(jsonText(query.success));
	return (value: unknown, subject: string | undefined): StoredForm<unknown> | undefined =>
		Option.match(payload(value), {
			onNone: () => undefined,
			onSome: (encoded) => ({ decode, encode, key: JSON.stringify([tag, encoded, subject ?? null]) }),
		});
}
