import type { Effect } from "effect";
import type { PrismaRelationMethods } from "#relation/prisma-methods.ts";
import type { PrismaError } from "./error.ts";

type AnyFunction = (...arguments_: readonly never[]) => unknown;

export type CollectionResult<TCollection> = TCollection extends {
	all: () => infer TResult;
}
	? Awaited<TResult>
	: never;

type NormalizeTerminal<TName, TResult> = TName extends "first" ? import("effect").Option.Option<Exclude<TResult, null>> : TResult;

type WrapReturn<TName, TResult, TContract, TModel extends string, TDatabaseId> =
	TResult extends PromiseLike<infer TValue>
		? Effect.Effect<NormalizeTerminal<TName, Awaited<TValue>>, PrismaError>
		: TResult extends object
			? Relation<TResult, TContract, TModel, TDatabaseId>
			: never;

type WrapFunction<TName, TFunction, TContract, TModel extends string, TDatabaseId> = TFunction extends {
	(...arguments_: infer TArguments1): infer TResult1;
	(...arguments_: infer TArguments2): infer TResult2;
	(...arguments_: infer TArguments3): infer TResult3;
	(...arguments_: infer TArguments4): infer TResult4;
	(...arguments_: infer TArguments5): infer TResult5;
	(...arguments_: infer TArguments6): infer TResult6;
}
	? ((...arguments_: TArguments1) => WrapReturn<TName, TResult1, TContract, TModel, TDatabaseId>) &
			((...arguments_: TArguments2) => WrapReturn<TName, TResult2, TContract, TModel, TDatabaseId>) &
			((...arguments_: TArguments3) => WrapReturn<TName, TResult3, TContract, TModel, TDatabaseId>) &
			((...arguments_: TArguments4) => WrapReturn<TName, TResult4, TContract, TModel, TDatabaseId>) &
			((...arguments_: TArguments5) => WrapReturn<TName, TResult5, TContract, TModel, TDatabaseId>) &
			((...arguments_: TArguments6) => WrapReturn<TName, TResult6, TContract, TModel, TDatabaseId>)
	: never;

type FunctionKeys<TValue> = {
	[TKey in keyof TValue]-?: TValue[TKey] extends AnyFunction ? TKey : never;
}[keyof TValue];

type ExplicitPrismaMethod =
	| "aggregate"
	| "avg"
	| "combine"
	| "count"
	| "cursor"
	| "delete"
	| "deleteAll"
	| "deleteCount"
	| "distinct"
	| "distinctOn"
	| "groupBy"
	| "include"
	| "max"
	| "min"
	| "select"
	| "sum"
	| "variant";

type RelationMethods<TCollection, TContract, TModel extends string, TDatabaseId> = {
	readonly [TKey in Exclude<FunctionKeys<TCollection>, ExplicitPrismaMethod>]: WrapFunction<TKey, TCollection[TKey], TContract, TModel, TDatabaseId>;
};

declare const RelationQueryTypeId: unique symbol;

export type RelationQuery<TValue, TContract, TModel extends string, TDatabaseId> = Effect.Effect<TValue, PrismaError> & {
	readonly [RelationQueryTypeId]: {
		readonly contract: TContract;
		readonly database: (database: TDatabaseId) => TDatabaseId;
		readonly model: TModel;
	};
};

export type Relation<TCollection, TContract = undefined, TModel extends string = string, TDatabaseId = undefined> = RelationQuery<
	CollectionResult<TCollection>,
	TContract,
	TModel,
	TDatabaseId
> &
	RelationMethods<TCollection, TContract, TModel, TDatabaseId> &
	PrismaRelationMethods<TCollection, TContract, TModel, TDatabaseId>;
