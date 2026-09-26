import type { orm } from "@prisma-next/sql-orm-client";
import type { Context, Effect, Layer } from "effect";
import type { PrismaError } from "../error.ts";
import type { Relation } from "../relation.ts";
import type { AnySqlContract } from "./executor.ts";

type OrmFor<Contract extends AnySqlContract> = ReturnType<typeof orm<Contract>>;
type DefaultNamespaceId<Contract extends AnySqlContract> = "__unbound__" extends keyof OrmFor<Contract>
	? "__unbound__"
	: "public" extends keyof OrmFor<Contract>
		? "public"
		: keyof OrmFor<Contract>;
export type DefaultModels<Contract extends AnySqlContract> = OrmFor<Contract>[DefaultNamespaceId<Contract>] extends infer Models extends object
	? Models
	: never;

type IsUnion<Value, Whole = Value> = Value extends unknown ? ([Whole] extends [Value] ? false : true) : never;

type IsSingletonString<Value extends string> = Record<never, never> extends Record<Value, never> ? false : true;

export const internalContextIdentifierPrefix = "\0@shivaedev/effect-prisma/internal/";

export type DatabaseIdentifierLiteral<Identifier extends string> = [Identifier] extends [`\0@shivaedev/effect-prisma/internal/${string}`]
	? never
	: string extends Identifier
		? never
		: true extends IsUnion<Identifier>
			? never
			: IsSingletonString<Identifier> extends true
				? Identifier
				: never;

export interface DatabaseIdentifier<Contract extends AnySqlContract, Identifier extends string> {
	readonly _contract: (contract: Contract) => Contract;
	readonly _databaseIdentifier: (identifier: Identifier) => Identifier;
}

type DatabaseModels<Contract extends AnySqlContract, Identifier extends string> = {
	readonly [Model in keyof DefaultModels<Contract>]: Relation<
		DefaultModels<Contract>[Model],
		Contract,
		Model & string,
		DatabaseIdentifier<Contract, Identifier>
	>;
};

export type DatabaseService<Contract extends AnySqlContract, Identifier extends string> = DatabaseModels<Contract, Identifier> & {
	transaction<A, E, R>(
		program: Effect.Effect<A, E, R> & (DatabaseIdentifier<Contract, Identifier> extends R ? unknown : never),
	): Effect.Effect<A, E | PrismaError, Exclude<R, DatabaseIdentifier<Contract, Identifier>>>;
};

/**
 * The driver-independent part of a database definition: the Context service
 * carrying the typed facade. Driver entrypoints add their own `layer` options.
 */
export interface DatabaseServiceHolder<Contract extends AnySqlContract, Identifier extends string>
	extends Context.Service<DatabaseIdentifier<Contract, Identifier>, DatabaseService<Contract, Identifier>> {}

export type AnyDatabase = Effect.Effect<unknown, never, unknown> & {
	readonly layer: (...arguments_: ReadonlyArray<never>) => Layer.Any;
};

export type DatabaseServiceOf<Database extends AnyDatabase> = Effect.Success<Database>;

export interface SqlDatabase<Contract extends AnySqlContract, Identifier extends string, Options>
	extends DatabaseServiceHolder<Contract, Identifier> {
	readonly layer: (options: Options) => Layer.Layer<DatabaseIdentifier<Contract, Identifier>, PrismaError>;
}
