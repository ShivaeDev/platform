import { Context, Schema } from "effect";
import { Rpc } from "effect/rpc";
import type { Key } from "#keys.ts";
import { LiveHint } from "#live.ts";
import type { CommandShape, QueryShape } from "#operation.ts";

export class QueryReads extends Context.Service<QueryReads, QueryShape["reads"]>()("@shivaedev/contract/QueryReads") {}

export class CommandInvalidation extends Context.Service<CommandInvalidation, CommandShape["invalidates"]>()(
	"@shivaedev/contract/CommandInvalidation",
) {}

export class KeyScope extends Context.Service<KeyScope, "session">()("@shivaedev/contract/KeyScope") {}

export interface QueryReference {
	readonly payload: unknown;
	readonly query: string;
}

type ReferenceSchema<TQuery extends QueryShape> = TQuery extends QueryShape
	? Schema.Struct<{ query: Schema.Literal<TQuery["name"]>; payload: TQuery["payload"] }>
	: never;

export class ChangesReads extends Context.Service<ChangesReads, (references: readonly QueryReference[]) => readonly Key[]>()(
	"@shivaedev/contract/ChangesReads",
) {}

export function queryKeys(queries: readonly QueryShape[], requested: readonly QueryReference[]): readonly Key[] {
	return requested.flatMap((reference) => {
		const declared = queries.find((candidate) => candidate.name === reference.query);
		if (declared === undefined) {
			throw new Error(`Unknown query: ${reference.query}`);
		}
		return declared.reads(reference.payload);
	});
}

function referenceSchemas<const TQueries extends readonly QueryShape[]>(
	queries: TQueries,
): Schema.$Array<Schema.Union<readonly ReferenceSchema<TQueries[number]>[]>>;
function referenceSchemas(queries: readonly QueryShape[]) {
	return Schema.Array(Schema.Union(queries.map((query) => Schema.Struct({ payload: query.payload, query: Schema.Literal(query.name) }))));
}

export function changesRpc<const TName extends string, const TQueries extends readonly QueryShape[]>(name: TName, queries: TQueries) {
	return Rpc.make(`${name}.$changes`, { payload: { queries: referenceSchemas(queries) }, stream: true, success: LiveHint }).annotate(
		ChangesReads,
		(requested) => queryKeys(queries, requested),
	);
}
