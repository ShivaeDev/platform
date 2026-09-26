import type { Contract as PrismaContract } from "@prisma-next/contract/types";
import type { SqlStorage } from "@prisma-next/sql-contract/types";
import type {
	AggregateBuilder,
	AggregateResult,
	AggregateSpec,
	DefaultModelRow,
	GroupedCollection,
	Collection as PrismaCollection,
} from "@prisma-next/sql-orm-client";
import type { Effect, Stream } from "effect";
import type { PrismaError } from "../error.ts";
import type { CollectionResult, Relation, RelationQuery } from "../relation.ts";
import type { IncludeMethod } from "./include.ts";

type AnyFunction = (...arguments_: ReadonlyArray<never>) => unknown;
type AnyPostgresContract = PrismaContract<SqlStorage>;
type FieldTuple<Row> = readonly [keyof Row & string, ...(keyof Row & string)[]];
type Simplify<Value> = { [Key in keyof Value]: Value[Key] };

type TerminalMethod<Method> = Method extends (...arguments_: infer Arguments) => PromiseLike<infer Value>
	? (...arguments_: Arguments) => Effect.Effect<Awaited<Value>, PrismaError>
	: never;

type SelectMethod<Collection, Contract, Model extends string, DatabaseId> = Contract extends AnyPostgresContract
	? Collection extends PrismaCollection<Contract, Model, infer _Row, infer State>
		? {
				select<Fields extends FieldTuple<DefaultModelRow<Contract, Model>>>(
					...fields: Fields
				): Relation<PrismaCollection<Contract, Model, Pick<DefaultModelRow<Contract, Model>, Fields[number]>, State>, Contract, Model, DatabaseId>;
			}
		: Record<never, never>
	: Collection extends { select: infer Select extends AnyFunction }
		? {
				select: Select extends (...arguments_: infer Arguments) => infer Result
					? (...arguments_: Arguments) => Result extends object ? Relation<Result, Contract, Model, DatabaseId> : never
					: never;
			}
		: Record<never, never>;

type AggregateConfigure<Collection> = Collection extends {
	aggregate: infer Method extends AnyFunction;
}
	? Exclude<Parameters<Method>[1], undefined>
	: never;

type AggregateSuccess<Collection, Contract extends AnyPostgresContract, Model extends string, Spec extends AggregateSpec> =
	Collection extends GroupedCollection<Contract, Model, infer Fields extends FieldTuple<DefaultModelRow<Contract, Model>>>
		? Array<Simplify<Pick<DefaultModelRow<Contract, Model>, Fields[number]> & AggregateResult<Spec>>>
		: AggregateResult<Spec>;

type AggregateMethod<Collection, Contract, Model extends string> = Contract extends AnyPostgresContract
	? Collection extends { aggregate: AnyFunction }
		? {
				aggregate<Spec extends AggregateSpec>(
					make: (aggregate: AggregateBuilder<Contract, Model>) => Spec,
					configure?: AggregateConfigure<Collection>,
				): Effect.Effect<AggregateSuccess<Collection, Contract, Model, Spec>, PrismaError>;
			}
		: Record<never, never>
	: Record<never, never>;

type CollectionMethods<Collection, Contract, Model extends string, DatabaseId> = Contract extends AnyPostgresContract
	? Collection extends PrismaCollection<Contract, Model, infer _Row, infer State>
		? {
				groupBy<Fields extends FieldTuple<DefaultModelRow<Contract, Model>>>(
					...fields: Fields
				): Relation<GroupedCollection<Contract, Model, Fields>, Contract, Model, DatabaseId>;
				cursor(
					values: State extends { readonly hasOrderBy: true } ? Partial<Record<keyof DefaultModelRow<Contract, Model> & string, unknown>> : never,
				): Relation<Collection, Contract, Model, DatabaseId>;
				distinct<Fields extends FieldTuple<DefaultModelRow<Contract, Model>>>(...fields: Fields): Relation<Collection, Contract, Model, DatabaseId>;
				distinctOn<Fields extends FieldTuple<DefaultModelRow<Contract, Model>>>(
					...fields: State extends { readonly hasOrderBy: true } ? Fields : never
				): Relation<Collection, Contract, Model, DatabaseId>;
			} & (State extends { readonly hasWhere: true }
				? {
						readonly [Key in "delete" | "deleteAll" | "deleteCount"]: TerminalMethod<Collection[Key]>;
					}
				: Record<never, never>)
		: Record<never, never>
	: Record<never, never>;

type CollectionConveniences<Collection, Contract, Model extends string, DatabaseId> = Contract extends AnyPostgresContract
	? Collection extends PrismaCollection<Contract, Model, infer Row, infer _State>
		? {
				readonly stream: Stream.Stream<Row, PrismaError>;
				count(): RelationQuery<number, Contract, Model, DatabaseId>;
				exists(): Effect.Effect<boolean, PrismaError>;
			}
		: Record<never, never>
	: CollectionResult<Collection> extends ReadonlyArray<infer Row>
		? {
				readonly stream: Stream.Stream<Row, PrismaError>;
				count(): Effect.Effect<number, PrismaError>;
				exists(): Effect.Effect<boolean, PrismaError>;
			}
		: Record<never, never>;

export type PrismaRelationMethods<Collection, Contract, Model extends string, DatabaseId> = SelectMethod<Collection, Contract, Model, DatabaseId> &
	IncludeMethod<Collection, Contract, Model, DatabaseId> &
	AggregateMethod<Collection, Contract, Model> &
	CollectionMethods<Collection, Contract, Model, DatabaseId> &
	CollectionConveniences<Collection, Contract, Model, DatabaseId>;
