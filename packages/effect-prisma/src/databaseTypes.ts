import type { orm } from "@prisma-next/sql-orm-client";
import type { Context, Effect, Layer } from "effect";
import type { PrismaError } from "#error.ts";
import type { AnySqlContract } from "#internal/executor.ts";
import type { Relation } from "#relation.ts";

type OrmFor<TContract extends AnySqlContract> = ReturnType<typeof orm<TContract>>;
type DefaultNamespaceId<TContract extends AnySqlContract> = "__unbound__" extends keyof OrmFor<TContract>
	? "__unbound__"
	: "public" extends keyof OrmFor<TContract>
		? "public"
		: keyof OrmFor<TContract>;
export type DefaultModels<TContract extends AnySqlContract> = OrmFor<TContract>[DefaultNamespaceId<TContract>] extends infer TModels extends object
	? TModels
	: never;

type IsUnion<TValue, TWhole = TValue> = TValue extends unknown ? ([TWhole] extends [TValue] ? false : true) : never;

type IsSingletonString<TValue extends string> = Record<never, never> extends Record<TValue, never> ? false : true;

export const internalContextIdentifierPrefix = "\0@shivaedev/effect-prisma/internal/";

export type DatabaseIdentifierLiteral<TIdentifier extends string> = [TIdentifier] extends [`\0@shivaedev/effect-prisma/internal/${string}`]
	? never
	: string extends TIdentifier
		? never
		: true extends IsUnion<TIdentifier>
			? never
			: IsSingletonString<TIdentifier> extends true
				? TIdentifier
				: never;

export interface DatabaseIdentifier<TContract extends AnySqlContract, TIdentifier extends string> {
	readonly _contract: (contract: TContract) => TContract;
	readonly _databaseIdentifier: (identifier: TIdentifier) => TIdentifier;
}

type DatabaseModels<TContract extends AnySqlContract, TIdentifier extends string> = {
	readonly [TModel in keyof DefaultModels<TContract>]: Relation<
		DefaultModels<TContract>[TModel],
		TContract,
		TModel & string,
		DatabaseIdentifier<TContract, TIdentifier>
	>;
};

export type DatabaseService<TContract extends AnySqlContract, TIdentifier extends string> = DatabaseModels<TContract, TIdentifier> & {
	transaction: <A, E, R>(
		program: Effect.Effect<A, E, R> & (DatabaseIdentifier<TContract, TIdentifier> extends R ? unknown : never),
	) => Effect.Effect<A, E | PrismaError, Exclude<R, DatabaseIdentifier<TContract, TIdentifier>>>;
};

export interface DatabaseServiceHolder<TContract extends AnySqlContract, TIdentifier extends string>
	extends Context.Service<DatabaseIdentifier<TContract, TIdentifier>, DatabaseService<TContract, TIdentifier>> {}

export type AnyDatabase = Effect.Effect<unknown, never, unknown> & {
	readonly layer: (...arguments_: readonly never[]) => Layer.Any;
};

export type DatabaseServiceOf<TDatabase extends AnyDatabase> = Effect.Success<TDatabase>;

export interface SqlDatabase<TContract extends AnySqlContract, TIdentifier extends string, TOptions>
	extends DatabaseServiceHolder<TContract, TIdentifier> {
	readonly layer: (options: TOptions) => Layer.Layer<DatabaseIdentifier<TContract, TIdentifier>, PrismaError>;
}
