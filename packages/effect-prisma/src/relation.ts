import type { Effect } from "effect";
import type { PrismaError } from "./error.js";
import type { PrismaRelationMethods } from "./relation/prisma-methods.js";

type AnyFunction = (...arguments_: ReadonlyArray<never>) => unknown;

export type CollectionResult<Collection> = Collection extends {
	all(): infer Result;
}
	? Awaited<Result>
	: never;

type NormalizeTerminal<Name, Result> = Name extends "first"
	? import("effect").Option.Option<Exclude<Result, null>>
	: Result;

type WrapReturn<Name, Result, Contract, Model extends string> =
	Result extends PromiseLike<infer Value>
		? Effect.Effect<NormalizeTerminal<Name, Awaited<Value>>, PrismaError>
		: Result extends object
			? Relation<Result, Contract, Model>
			: never;

type WrapFunction<
	Name,
	Function_,
	Contract,
	Model extends string,
> = Function_ extends {
	(...arguments_: infer Arguments1): infer Result1;
	(...arguments_: infer Arguments2): infer Result2;
	(...arguments_: infer Arguments3): infer Result3;
	(...arguments_: infer Arguments4): infer Result4;
	(...arguments_: infer Arguments5): infer Result5;
	(...arguments_: infer Arguments6): infer Result6;
}
	? ((
			...arguments_: Arguments1
		) => WrapReturn<Name, Result1, Contract, Model>) &
			((
				...arguments_: Arguments2
			) => WrapReturn<Name, Result2, Contract, Model>) &
			((
				...arguments_: Arguments3
			) => WrapReturn<Name, Result3, Contract, Model>) &
			((
				...arguments_: Arguments4
			) => WrapReturn<Name, Result4, Contract, Model>) &
			((
				...arguments_: Arguments5
			) => WrapReturn<Name, Result5, Contract, Model>) &
			((
				...arguments_: Arguments6
			) => WrapReturn<Name, Result6, Contract, Model>)
	: never;

type FunctionKeys<Value> = {
	[Key in keyof Value]-?: Value[Key] extends AnyFunction ? Key : never;
}[keyof Value];

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

type RelationMethods<Collection, Contract, Model extends string> = {
	readonly [Key in Exclude<
		FunctionKeys<Collection>,
		ExplicitPrismaMethod
	>]: WrapFunction<Key, Collection[Key], Contract, Model>;
};

declare const RelationQueryTypeId: unique symbol;

export type RelationQuery<
	Value,
	Contract,
	Model extends string,
> = Effect.Effect<Value, PrismaError> & {
	readonly [RelationQueryTypeId]: {
		readonly contract: Contract;
		readonly model: Model;
	};
};

export type Relation<
	Collection,
	Contract = undefined,
	Model extends string = string,
> = RelationQuery<CollectionResult<Collection>, Contract, Model> &
	RelationMethods<Collection, Contract, Model> &
	PrismaRelationMethods<Collection, Contract, Model>;
