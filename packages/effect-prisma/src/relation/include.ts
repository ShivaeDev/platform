import type { DefaultModelRow, Collection as PrismaCollection, RelationNames } from "@prisma-next/sql-orm-client";
import type { Relation, RelationQuery } from "../relation.ts";
import type { AnyPostgresContract, IncludedRelationValue, IsToManyRelation, RelatedModelNameOf } from "./include-metadata.ts";

type Simplify<Value> = { [Key in keyof Value]: Value[Key] };

type QueryValue<Query> = Query extends RelationQuery<infer Value, infer _Contract, infer _Model, infer _DatabaseId> ? Value : never;

type AcceptRelatedQuery<Query, Contract extends AnyPostgresContract, Model extends string, DatabaseId> = [Query] extends [
	RelationQuery<infer _Value, infer QueryContract, infer QueryModel, infer QueryDatabaseId>,
]
	? [QueryContract] extends [Contract]
		? [Contract] extends [QueryContract]
			? [QueryDatabaseId] extends [DatabaseId]
				? [DatabaseId] extends [QueryDatabaseId]
					? QueryModel extends Model
						? unknown
						: never
					: never
				: never
			: never
		: never
	: never;

type IncludedQueryValue<Query, Contract extends AnyPostgresContract, Model extends string, RelationName extends string> =
	QueryValue<Query> extends ReadonlyArray<infer Row> ? IncludedRelationValue<Contract, Model, RelationName, Row> : QueryValue<Query>;

type QueryShapeValue<Shape extends Readonly<Record<string, unknown>>> = {
	readonly [Key in keyof Shape]: QueryValue<Shape[Key]>;
};

type AcceptRelatedQueryShape<
	Shape extends Readonly<Record<string, unknown>>,
	Contract extends AnyPostgresContract,
	Model extends string,
	DatabaseId,
> = {
	readonly [Key in keyof Shape]: Shape[Key] & AcceptRelatedQuery<Shape[Key], Contract, Model, DatabaseId>;
};

type WithIncludedRelation<Collection, Contract extends AnyPostgresContract, Model extends string, RelationName extends string, Value> =
	Collection extends PrismaCollection<Contract, Model, infer Row, infer State>
		? PrismaCollection<Contract, Model, Simplify<Row & { readonly [Key in RelationName]: Value }>, State>
		: never;

interface IncludeOverloads<Collection, Contract extends AnyPostgresContract, Model extends string, DatabaseId> {
	<RelationName extends RelationNames<Contract, Model>>(
		relationName: RelationName,
	): Relation<
		WithIncludedRelation<
			Collection,
			Contract,
			Model,
			RelationName,
			IncludedRelationValue<Contract, Model, RelationName, DefaultModelRow<Contract, RelatedModelNameOf<Contract, Model, RelationName>>>
		>,
		Contract,
		Model,
		DatabaseId
	>;
	<RelationName extends RelationNames<Contract, Model>, Query>(
		relationName: RelationName,
		query: Query & AcceptRelatedQuery<Query, Contract, RelatedModelNameOf<Contract, Model, RelationName>, DatabaseId>,
	): Relation<
		WithIncludedRelation<Collection, Contract, Model, RelationName, IncludedQueryValue<Query, Contract, Model, RelationName>>,
		Contract,
		Model,
		DatabaseId
	>;
	<RelationName extends RelationNames<Contract, Model>, Shape extends Readonly<Record<string, unknown>>>(
		relationName: RelationName,
		shape: IsToManyRelation<Contract, Model, RelationName> extends true
			? keyof Shape extends never
				? never
				: Shape & AcceptRelatedQueryShape<Shape, Contract, RelatedModelNameOf<Contract, Model, RelationName>, DatabaseId>
			: never,
	): Relation<WithIncludedRelation<Collection, Contract, Model, RelationName, QueryShapeValue<Shape>>, Contract, Model, DatabaseId>;
}

export type IncludeMethod<Collection, Contract, Model extends string, DatabaseId> = Contract extends AnyPostgresContract
	? Collection extends PrismaCollection<Contract, Model, infer _Row, infer _State>
		? { include: IncludeOverloads<Collection, Contract, Model, DatabaseId> }
		: Record<never, never>
	: Record<never, never>;
