import { all } from "@prisma-next/sql-orm-client";
import type { Effect, Option } from "effect";
import { type CleanedWhere, type DynamicField, type Expression, whereExpression } from "./where.ts";

export interface DynamicRelation<TRequirements> extends Effect.Effect<readonly Record<string, unknown>[], unknown, TRequirements> {
	count: () => Effect.Effect<number, unknown, TRequirements>;
	create: (data: Record<string, unknown>) => Effect.Effect<Record<string, unknown>, unknown, TRequirements>;
	delete: () => Effect.Effect<Record<string, unknown> | null, unknown, TRequirements>;
	deleteAll: () => Effect.Effect<readonly Record<string, unknown>[], unknown, TRequirements>;
	first: () => Effect.Effect<Option.Option<Record<string, unknown>>, unknown, TRequirements>;
	orderBy: (ordering: (fields: Record<string, DynamicField>) => unknown) => DynamicRelation<TRequirements>;
	select: (...fields: readonly string[]) => DynamicRelation<TRequirements>;
	skip: (count: number) => DynamicRelation<TRequirements>;
	take: (count: number) => DynamicRelation<TRequirements>;
	update: (data: Record<string, unknown>) => Effect.Effect<Record<string, unknown> | null, unknown, TRequirements>;
	updateAll: (data: Record<string, unknown>) => Effect.Effect<readonly Record<string, unknown>[], unknown, TRequirements>;
	where: (predicate: (fields: Record<string, DynamicField>) => Expression) => DynamicRelation<TRequirements>;
}

export const refineRelation = <TRequirements>(
	relation: DynamicRelation<TRequirements>,
	options: {
		readonly where?: readonly CleanedWhere[] | undefined;
		readonly select?: readonly string[] | undefined;
		readonly limit?: number | undefined;
		readonly offset?: number | undefined;
		readonly sortBy?:
			| {
					readonly direction: "asc" | "desc";
					readonly field: string;
			  }
			| undefined;
	},
): DynamicRelation<TRequirements> => {
	let refined = relation;
	if (options.where !== undefined) {
		refined = refined.where((fields) => {
			const expression = whereExpression(fields, options.where ?? []);
			return expression ?? all();
		});
	}
	if (options.sortBy !== undefined) {
		refined = refined.orderBy((fields) => {
			const field = fields[options.sortBy?.field ?? ""];
			if (field === undefined) {
				throw new TypeError(`Unknown database field: ${options.sortBy?.field}`);
			}
			return options.sortBy?.direction === "desc" ? field.desc() : field.asc();
		});
	}
	if (options.offset !== undefined) {
		refined = refined.skip(options.offset);
	}
	if (options.limit !== undefined) {
		refined = refined.take(options.limit);
	}
	if (options.select !== undefined && options.select.length > 0) {
		refined = refined.select(...options.select);
	}
	return refined;
};
