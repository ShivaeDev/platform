import type { Contract as PrismaContract } from "@prisma-next/contract/types";
import type { SqlStorage } from "@prisma-next/sql-contract/types";
import type { RelationsOf } from "@prisma-next/sql-orm-client";

export type AnyPostgresContract = PrismaContract<SqlStorage>;

type RelationDefinition<
	Contract extends AnyPostgresContract,
	Model extends string,
	RelationName extends string,
> = RelationName extends keyof RelationsOf<Contract, Model>
	? RelationsOf<Contract, Model>[RelationName]
	: never;

type RelationCardinalityOf<
	Contract extends AnyPostgresContract,
	Model extends string,
	RelationName extends string,
> =
	RelationDefinition<Contract, Model, RelationName> extends {
		readonly cardinality: infer Cardinality extends string;
	}
		? Cardinality
		: never;

export type IsToManyRelation<
	Contract extends AnyPostgresContract,
	Model extends string,
	RelationName extends string,
> =
	RelationCardinalityOf<Contract, Model, RelationName> extends "1:N" | "N:M"
		? true
		: false;

export type RelatedModelNameOf<
	Contract extends AnyPostgresContract,
	Model extends string,
	RelationName extends string,
> =
	RelationDefinition<Contract, Model, RelationName> extends {
		readonly to: { readonly model: infer Related extends string };
	}
		? Related
		: never;

type RelationLocalFields<
	Contract extends AnyPostgresContract,
	Model extends string,
	RelationName extends string,
> =
	RelationDefinition<Contract, Model, RelationName> extends {
		readonly on: {
			readonly localFields: infer Fields extends readonly string[];
		};
	}
		? Fields
		: readonly [];

type DefaultNamespace<Contract extends AnyPostgresContract> =
	Contract["domain"]["namespaces"][keyof Contract["domain"]["namespaces"]];

type ModelFields<Contract extends AnyPostgresContract, Model extends string> =
	DefaultNamespace<Contract> extends {
		readonly models: infer Models;
	}
		? Model extends keyof Models
			? Models[Model] extends { readonly fields: infer Fields }
				? Fields
				: never
			: never
		: never;

type AnyNullableField<
	Fields,
	Names extends readonly string[],
> = Names extends readonly [
	infer Head extends string,
	...infer Tail extends readonly string[],
]
	? Head extends keyof Fields
		? Fields[Head] extends { readonly nullable: true }
			? true
			: AnyNullableField<Fields, Tail>
		: true
	: false;

export type IncludedRelationValue<
	Contract extends AnyPostgresContract,
	Model extends string,
	RelationName extends string,
	Value,
> =
	RelationCardinalityOf<Contract, Model, RelationName> extends "1:N" | "N:M"
		? Array<Value>
		: RelationCardinalityOf<Contract, Model, RelationName> extends "N:1"
			? AnyNullableField<
					ModelFields<Contract, Model>,
					RelationLocalFields<Contract, Model, RelationName>
				> extends true
				? Value | null
				: Value
			: Value | null;
