import { all } from "@shivaedev/effect-prisma";
import type { Effect, Option } from "effect";
import { type CleanedWhere, type DynamicField, type Expression, whereExpression } from "./where.ts";

export interface DynamicRelation<Requirements> extends Effect.Effect<ReadonlyArray<Record<string, unknown>>, unknown, Requirements> {
	where(predicate: (fields: Record<string, DynamicField>) => Expression): DynamicRelation<Requirements>;
	orderBy(ordering: (fields: Record<string, DynamicField>) => unknown): DynamicRelation<Requirements>;
	take(count: number): DynamicRelation<Requirements>;
	skip(count: number): DynamicRelation<Requirements>;
	select(...fields: ReadonlyArray<string>): DynamicRelation<Requirements>;
	first(): Effect.Effect<Option.Option<Record<string, unknown>>, unknown, Requirements>;
	count(): Effect.Effect<number, unknown, Requirements>;
	create(data: Record<string, unknown>): Effect.Effect<Record<string, unknown>, unknown, Requirements>;
	update(data: Record<string, unknown>): Effect.Effect<Record<string, unknown> | null, unknown, Requirements>;
	updateAll(data: Record<string, unknown>): Effect.Effect<ReadonlyArray<Record<string, unknown>>, unknown, Requirements>;
	delete(): Effect.Effect<Record<string, unknown> | null, unknown, Requirements>;
	deleteAll(): Effect.Effect<ReadonlyArray<Record<string, unknown>>, unknown, Requirements>;
}

export const refineRelation = <Requirements>(
	relation: DynamicRelation<Requirements>,
	options: {
		readonly where?: ReadonlyArray<CleanedWhere> | undefined;
		readonly select?: ReadonlyArray<string> | undefined;
		readonly limit?: number | undefined;
		readonly offset?: number | undefined;
		readonly sortBy?:
			| {
					readonly direction: "asc" | "desc";
					readonly field: string;
			  }
			| undefined;
	},
): DynamicRelation<Requirements> => {
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
	if (options.offset !== undefined) refined = refined.skip(options.offset);
	if (options.limit !== undefined) refined = refined.take(options.limit);
	if (options.select !== undefined && options.select.length > 0) {
		refined = refined.select(...options.select);
	}
	return refined;
};
