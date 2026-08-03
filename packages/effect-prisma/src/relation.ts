import type { Effect } from "effect";
import type { PrismaError } from "./error.js";
import type {
	NormalizePrismaArguments,
	NormalizePrismaValue,
} from "./internal/type-normalization.js";
import type { PrismaRelationMethods } from "./relation/prisma-methods.js";

type AnyFunction = (...arguments_: ReadonlyArray<never>) => unknown;

export type CollectionResult<Collection> = Collection extends {
	all(): infer Result;
}
	? NormalizePrismaValue<Awaited<Result>>
	: never;

type NormalizeTerminal<Name, Result> = Name extends "first"
	? import("effect").Option.Option<Exclude<Result, null>>
	: Result;

type WrapReturn<Name, Result, Requirement, Contract, Model extends string> =
	Result extends PromiseLike<infer Value>
		? Effect.Effect<
				NormalizeTerminal<Name, NormalizePrismaValue<Awaited<Value>>>,
				PrismaError,
				Requirement
			>
		: Result extends object
			? Relation<Result, Requirement, Contract, Model>
			: never;

type WrapFunction<
	Name,
	Function_,
	Requirement,
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
			...arguments_: NormalizePrismaArguments<Arguments1>
		) => WrapReturn<Name, Result1, Requirement, Contract, Model>) &
			((
				...arguments_: NormalizePrismaArguments<Arguments2>
			) => WrapReturn<Name, Result2, Requirement, Contract, Model>) &
			((
				...arguments_: NormalizePrismaArguments<Arguments3>
			) => WrapReturn<Name, Result3, Requirement, Contract, Model>) &
			((
				...arguments_: NormalizePrismaArguments<Arguments4>
			) => WrapReturn<Name, Result4, Requirement, Contract, Model>) &
			((
				...arguments_: NormalizePrismaArguments<Arguments5>
			) => WrapReturn<Name, Result5, Requirement, Contract, Model>) &
			((
				...arguments_: NormalizePrismaArguments<Arguments6>
			) => WrapReturn<Name, Result6, Requirement, Contract, Model>)
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

type RelationMethods<
	Collection,
	Requirement,
	Contract,
	Model extends string,
> = {
	readonly [Key in Exclude<
		FunctionKeys<Collection>,
		ExplicitPrismaMethod
	>]: WrapFunction<Key, Collection[Key], Requirement, Contract, Model>;
};

declare const RelationQueryTypeId: unique symbol;

export type RelationQuery<
	Value,
	Requirement,
	Contract,
	Model extends string,
> = Effect.Effect<Value, PrismaError, Requirement> & {
	readonly [RelationQueryTypeId]: {
		readonly contract: Contract;
		readonly model: Model;
	};
};

export type Relation<
	Collection,
	Requirement,
	Contract = undefined,
	Model extends string = string,
> = RelationQuery<CollectionResult<Collection>, Requirement, Contract, Model> &
	RelationMethods<Collection, Requirement, Contract, Model> &
	PrismaRelationMethods<Collection, Requirement, Contract, Model>;
