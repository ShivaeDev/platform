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
import type { PrismaError } from "../error.js";
import type { CollectionResult, Relation } from "../relation.js";

type AnyFunction = (...arguments_: ReadonlyArray<never>) => unknown;
type AnyPostgresContract = PrismaContract<SqlStorage>;
type FieldTuple<Row> = readonly [keyof Row & string, ...(keyof Row & string)[]];
type Simplify<Value> = { [Key in keyof Value]: Value[Key] };

type TerminalMethod<Method, Requirement> = Method extends (
	...arguments_: infer Arguments
) => PromiseLike<infer Value>
	? (
			...arguments_: Arguments
		) => Effect.Effect<Awaited<Value>, PrismaError, Requirement>
	: never;

type SelectMethod<
	Collection,
	Requirement,
	Contract,
	Model extends string,
> = Contract extends AnyPostgresContract
	? Collection extends PrismaCollection<
			Contract,
			Model,
			infer _Row,
			infer State
		>
		? {
				select<Fields extends FieldTuple<DefaultModelRow<Contract, Model>>>(
					...fields: Fields
				): Relation<
					PrismaCollection<
						Contract,
						Model,
						Pick<DefaultModelRow<Contract, Model>, Fields[number]>,
						State
					>,
					Requirement,
					Contract,
					Model
				>;
			}
		: Record<never, never>
	: Collection extends { select: infer Select extends AnyFunction }
		? {
				select: Select extends (...arguments_: infer Arguments) => infer Result
					? (
							...arguments_: Arguments
						) => Result extends object
							? Relation<Result, Requirement, Contract, Model>
							: never
					: never;
			}
		: Record<never, never>;

type AggregateConfigure<Collection> = Collection extends {
	aggregate: infer Method extends AnyFunction;
}
	? Exclude<Parameters<Method>[1], undefined>
	: never;

type AggregateSuccess<
	Collection,
	Contract extends AnyPostgresContract,
	Model extends string,
	Spec extends AggregateSpec,
> =
	Collection extends GroupedCollection<
		Contract,
		Model,
		infer Fields extends FieldTuple<DefaultModelRow<Contract, Model>>
	>
		? Array<
				Simplify<
					Pick<DefaultModelRow<Contract, Model>, Fields[number]> &
						AggregateResult<Spec>
				>
			>
		: AggregateResult<Spec>;

type AggregateMethod<
	Collection,
	Requirement,
	Contract,
	Model extends string,
> = Contract extends AnyPostgresContract
	? Collection extends { aggregate: AnyFunction }
		? {
				aggregate<Spec extends AggregateSpec>(
					make: (aggregate: AggregateBuilder<Contract, Model>) => Spec,
					configure?: AggregateConfigure<Collection>,
				): Effect.Effect<
					AggregateSuccess<Collection, Contract, Model, Spec>,
					PrismaError,
					Requirement
				>;
			}
		: Record<never, never>
	: Record<never, never>;

type CollectionMethods<
	Collection,
	Requirement,
	Contract,
	Model extends string,
> = Contract extends AnyPostgresContract
	? Collection extends PrismaCollection<
			Contract,
			Model,
			infer _Row,
			infer State
		>
		? {
				groupBy<Fields extends FieldTuple<DefaultModelRow<Contract, Model>>>(
					...fields: Fields
				): Relation<
					GroupedCollection<Contract, Model, Fields>,
					Requirement,
					Contract,
					Model
				>;
				cursor(
					values: State extends { readonly hasOrderBy: true }
						? Partial<
								Record<keyof DefaultModelRow<Contract, Model> & string, unknown>
							>
						: never,
				): Relation<Collection, Requirement, Contract, Model>;
				distinct<Fields extends FieldTuple<DefaultModelRow<Contract, Model>>>(
					...fields: Fields
				): Relation<Collection, Requirement, Contract, Model>;
				distinctOn<Fields extends FieldTuple<DefaultModelRow<Contract, Model>>>(
					...fields: State extends { readonly hasOrderBy: true }
						? Fields
						: never
				): Relation<Collection, Requirement, Contract, Model>;
			} & (State extends { readonly hasWhere: true }
				? {
						readonly [Key in
							| "delete"
							| "deleteAll"
							| "deleteCount"]: TerminalMethod<Collection[Key], Requirement>;
					}
				: Record<never, never>)
		: Record<never, never>
	: Record<never, never>;

type CollectionConveniences<
	Collection,
	Requirement,
	Contract,
	Model extends string,
> = Contract extends AnyPostgresContract
	? Collection extends PrismaCollection<
			Contract,
			Model,
			infer Row,
			infer _State
		>
		? {
				readonly stream: Stream.Stream<Row, PrismaError, Requirement>;
				exists(): Effect.Effect<boolean, PrismaError, Requirement>;
			}
		: Record<never, never>
	: CollectionResult<Collection> extends ReadonlyArray<infer Row>
		? {
				readonly stream: Stream.Stream<Row, PrismaError, Requirement>;
				exists(): Effect.Effect<boolean, PrismaError, Requirement>;
			}
		: Record<never, never>;

export type PrismaRelationMethods<
	Collection,
	Requirement,
	Contract,
	Model extends string,
> = SelectMethod<Collection, Requirement, Contract, Model> &
	AggregateMethod<Collection, Requirement, Contract, Model> &
	CollectionMethods<Collection, Requirement, Contract, Model> &
	CollectionConveniences<Collection, Requirement, Contract, Model>;
