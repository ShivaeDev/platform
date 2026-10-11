import type { DefaultModelRow, Collection as PrismaCollection, RelationNames } from "@prisma-next/sql-orm-client";
import type { Relation, RelationQuery } from "#relation.ts";
import type { AnyPostgresContract, IncludedRelationValue, IsToManyRelation, RelatedModelNameOf } from "./include-metadata.ts";

type Simplify<TValue> = { [TKey in keyof TValue]: TValue[TKey] };

type QueryValue<TQuery> = TQuery extends RelationQuery<infer TValue, infer _Contract, infer _Model, infer _DatabaseId> ? TValue : never;

type AcceptRelatedQuery<TQuery, TContract extends AnyPostgresContract, TModel extends string, TDatabaseId> = [TQuery] extends [
	RelationQuery<infer _Value, infer TQueryContract, infer TQueryModel, infer TQueryDatabaseId>,
]
	? [TQueryContract] extends [TContract]
		? [TContract] extends [TQueryContract]
			? [TQueryDatabaseId] extends [TDatabaseId]
				? [TDatabaseId] extends [TQueryDatabaseId]
					? TQueryModel extends TModel
						? unknown
						: never
					: never
				: never
			: never
		: never
	: never;

type IncludedQueryValue<TQuery, TContract extends AnyPostgresContract, TModel extends string, TRelationName extends string> =
	QueryValue<TQuery> extends ReadonlyArray<infer TRow> ? IncludedRelationValue<TContract, TModel, TRelationName, TRow> : QueryValue<TQuery>;

type QueryShapeValue<TShape extends Readonly<Record<string, unknown>>> = {
	readonly [TKey in keyof TShape]: QueryValue<TShape[TKey]>;
};

type AcceptRelatedQueryShape<
	TShape extends Readonly<Record<string, unknown>>,
	TContract extends AnyPostgresContract,
	TModel extends string,
	TDatabaseId,
> = {
	readonly [TKey in keyof TShape]: TShape[TKey] & AcceptRelatedQuery<TShape[TKey], TContract, TModel, TDatabaseId>;
};

type WithIncludedRelation<TCollection, TContract extends AnyPostgresContract, TModel extends string, TRelationName extends string, TValue> =
	TCollection extends PrismaCollection<TContract, TModel, infer TRow, infer TState>
		? PrismaCollection<TContract, TModel, Simplify<TRow & { readonly [TKey in TRelationName]: TValue }>, TState>
		: never;

interface IncludeOverloads<TCollection, TContract extends AnyPostgresContract, TModel extends string, TDatabaseId> {
	<TRelationName extends RelationNames<TContract, TModel>>(
		relationName: TRelationName,
	): Relation<
		WithIncludedRelation<
			TCollection,
			TContract,
			TModel,
			TRelationName,
			IncludedRelationValue<TContract, TModel, TRelationName, DefaultModelRow<TContract, RelatedModelNameOf<TContract, TModel, TRelationName>>>
		>,
		TContract,
		TModel,
		TDatabaseId
	>;
	<TRelationName extends RelationNames<TContract, TModel>, TQuery>(
		relationName: TRelationName,
		query: TQuery & AcceptRelatedQuery<TQuery, TContract, RelatedModelNameOf<TContract, TModel, TRelationName>, TDatabaseId>,
	): Relation<
		WithIncludedRelation<TCollection, TContract, TModel, TRelationName, IncludedQueryValue<TQuery, TContract, TModel, TRelationName>>,
		TContract,
		TModel,
		TDatabaseId
	>;
	<TRelationName extends RelationNames<TContract, TModel>, TShape extends Readonly<Record<string, unknown>>>(
		relationName: TRelationName,
		shape: IsToManyRelation<TContract, TModel, TRelationName> extends true
			? keyof TShape extends never
				? never
				: TShape & AcceptRelatedQueryShape<TShape, TContract, RelatedModelNameOf<TContract, TModel, TRelationName>, TDatabaseId>
			: never,
	): Relation<WithIncludedRelation<TCollection, TContract, TModel, TRelationName, QueryShapeValue<TShape>>, TContract, TModel, TDatabaseId>;
}

export type IncludeMethod<TCollection, TContract, TModel extends string, TDatabaseId> = TContract extends AnyPostgresContract
	? TCollection extends PrismaCollection<TContract, TModel, infer _Row, infer _State>
		? { include: IncludeOverloads<TCollection, TContract, TModel, TDatabaseId> }
		: Record<never, never>
	: Record<never, never>;
