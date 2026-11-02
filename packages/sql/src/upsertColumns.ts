import type { BigDecimal } from "effect";
import type { Model } from "effect/schema";

export type UpsertColumn<TModel extends Model.Any, TColumn extends keyof TModel["fields"]> =
	| TColumn
	| {
			readonly column: TColumn;
			readonly mode: "keepOnNull";
	  }
	| {
			[TKey in TColumn]: NonNullable<TModel["fields"][TKey]["Type"]> extends number | bigint | BigDecimal.BigDecimal
				? { readonly column: TKey; readonly mode: "add" }
				: never;
	  }[TColumn];

export type UpsertAssignment = string | { readonly column: string; readonly mode: "add" | "keepOnNull" };
