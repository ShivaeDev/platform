import { Context, Effect, Option, Schema } from "effect";
import { Rpc } from "effect/rpc";
import type { Key } from "@shivaedev/changes/keys.ts";
import { LiveHint } from "#live.ts";
import type { CommandShape, QueryShape } from "#operation.ts";
import type { Viewer } from "#readPolicy.ts";
import { MissingReadPolicy, QueryReadDenied } from "#readPolicyErrors.ts";

export class QueryDefinition extends Context.Service<QueryDefinition, { readonly definition: QueryShape }>()("@shivaedev/contract/QueryDefinition") {}
export interface QueryRequest {
	readonly payload: unknown;
	readonly query: QueryShape;
}
export class ChangesQueries extends Context.Service<
	ChangesQueries,
	{
		readonly resolve: (references: readonly QueryReference[]) => Effect.Effect<readonly QueryRequest[]>;
	}
>()("@shivaedev/contract/ChangesQueries") {}

export class CommandInvalidation extends Context.Service<CommandInvalidation, { readonly invalidates: CommandShape["invalidates"] }>()(
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

function resolveQueries(queries: readonly QueryShape[], requested: readonly QueryReference[]) {
	return Effect.forEach(requested, (reference) => {
		const query = queries.find((candidate) => candidate.name === reference.query);
		return query === undefined ? Effect.die(new Error(`Unknown query: ${reference.query}`)) : Effect.succeed({ payload: reference.payload, query });
	});
}

export const queryKeys = Effect.fnUntraced(function* (
	queries: readonly QueryShape[],
	requested: readonly QueryReference[],
	viewer: Option.Option<Viewer> = Option.none(),
): Effect.fn.Return<readonly Key[]> {
	const resolved = yield* resolveQueries(queries, requested);
	return resolved.flatMap(({ query, payload }) => query.reads(payload, viewer));
});

function referenceSchemas<const TQueries extends readonly QueryShape[]>(
	queries: TQueries,
): Schema.$Array<Schema.Union<readonly ReferenceSchema<TQueries[number]>[]>>;
function referenceSchemas(queries: readonly QueryShape[]) {
	return Schema.Array(Schema.Union(queries.map((query) => Schema.Struct({ payload: query.payload, query: Schema.Literal(query.name) }))));
}

export function changesRpc<const TName extends string, const TQueries extends readonly QueryShape[]>(name: TName, queries: TQueries) {
	return Rpc.make(`${name}.$changes`, {
		error: Schema.Union([MissingReadPolicy, QueryReadDenied]),
		payload: { queries: referenceSchemas(queries) },
		stream: true,
		success: LiveHint,
	}).annotate(ChangesQueries, { resolve: (references) => resolveQueries(queries, references) });
}
