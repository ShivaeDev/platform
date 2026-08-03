import { all, and, not, or } from "@shivaedev/effect-prisma";
import type { Where } from "better-auth";
import type { Effect, Option } from "effect";

type CleanedWhere = Required<Where>;
type Expression = Parameters<typeof and>[number];

interface DynamicField {
	eq(value: unknown): Expression;
	neq(value: unknown): Expression;
	gt(value: unknown): Expression;
	gte(value: unknown): Expression;
	lt(value: unknown): Expression;
	lte(value: unknown): Expression;
	in(value: ReadonlyArray<unknown>): Expression;
	notIn(value: ReadonlyArray<unknown>): Expression;
	like(value: string): Expression;
	ilike?(value: string): Expression;
	isNull(): Expression;
	isNotNull(): Expression;
	asc(): unknown;
	desc(): unknown;
}

export interface DynamicRelation<Requirements> {
	where(
		predicate: (fields: Record<string, DynamicField>) => Expression,
	): DynamicRelation<Requirements>;
	orderBy(
		ordering: (fields: Record<string, DynamicField>) => unknown,
	): DynamicRelation<Requirements>;
	take(count: number): DynamicRelation<Requirements>;
	skip(count: number): DynamicRelation<Requirements>;
	select(...fields: ReadonlyArray<string>): DynamicRelation<Requirements>;
	first(): Effect.Effect<
		Option.Option<Record<string, unknown>>,
		unknown,
		Requirements
	>;
	count(): Effect.Effect<number, unknown, Requirements>;
	create(
		data: Record<string, unknown>,
	): Effect.Effect<Record<string, unknown>, unknown, Requirements>;
	update(
		data: Record<string, unknown>,
	): Effect.Effect<Record<string, unknown> | null, unknown, Requirements>;
	updateAll(
		data: Record<string, unknown>,
	): Effect.Effect<
		ReadonlyArray<Record<string, unknown>>,
		unknown,
		Requirements
	>;
	delete(): Effect.Effect<
		Record<string, unknown> | null,
		unknown,
		Requirements
	>;
	deleteAll(): Effect.Effect<
		ReadonlyArray<Record<string, unknown>>,
		unknown,
		Requirements
	>;
}

const escapeLike = (value: string): string =>
	value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");

const comparison = (
	field: DynamicField,
	where: CleanedWhere,
): Expression | undefined => {
	const value = where.value;
	if (
		where.mode === "insensitive" &&
		typeof value === "string" &&
		field.ilike !== undefined
	) {
		if (where.operator === "eq") return field.ilike(escapeLike(value));
		if (where.operator === "ne") return not(field.ilike(escapeLike(value)));
	}
	switch (where.operator) {
		case "eq":
			return value === null ? field.isNull() : field.eq(value);
		case "ne":
			return value === null ? field.isNotNull() : field.neq(value);
		case "lt":
			return field.lt(value);
		case "lte":
			return field.lte(value);
		case "gt":
			return field.gt(value);
		case "gte":
			return field.gte(value);
		case "in": {
			const values = (Array.isArray(value) ? value : [value]).filter(
				(item) => item !== null,
			);
			const ilike = field.ilike;
			return values.length === 0
				? and(field.isNull(), field.isNotNull())
				: where.mode === "insensitive" &&
						ilike !== undefined &&
						values.every((item) => typeof item === "string")
					? or(...values.map((item) => ilike(escapeLike(String(item)))))
					: field.in(values);
		}
		case "not_in": {
			const values = (Array.isArray(value) ? value : [value]).filter(
				(item) => item !== null,
			);
			if (values.length === 0) return undefined;
			const ilike = field.ilike;
			return where.mode === "insensitive" &&
				ilike !== undefined &&
				values.every((item) => typeof item === "string")
				? and(...values.map((item) => not(ilike(escapeLike(String(item))))))
				: field.notIn(values);
		}
		case "contains":
		case "starts_with":
		case "ends_with": {
			if (typeof value !== "string") {
				throw new TypeError(`${where.operator} requires a string value`);
			}
			const escaped = escapeLike(value);
			const pattern =
				where.operator === "contains"
					? `%${escaped}%`
					: where.operator === "starts_with"
						? `${escaped}%`
						: `%${escaped}`;
			return where.mode === "insensitive" && field.ilike !== undefined
				? field.ilike(pattern)
				: field.like(pattern);
		}
	}
};

const whereExpression = (
	fields: Record<string, DynamicField>,
	where: ReadonlyArray<CleanedWhere>,
): Expression | undefined => {
	const conjunctions: Expression[] = [];
	const disjunctions: Expression[] = [];

	for (const condition of where) {
		const field = fields[condition.field];
		if (field === undefined) {
			throw new TypeError(`Unknown database field: ${condition.field}`);
		}
		const expression = comparison(field, condition);
		if (expression === undefined) continue;
		(condition.connector === "OR" ? disjunctions : conjunctions).push(
			expression,
		);
	}

	if (disjunctions.length > 0) conjunctions.push(or(...disjunctions));
	if (conjunctions.length === 0) return all();
	return conjunctions.length === 1 ? conjunctions[0] : and(...conjunctions);
};

export const refineRelation = <Requirements>(
	relation: DynamicRelation<Requirements>,
	options: {
		readonly where?: ReadonlyArray<CleanedWhere>;
		readonly select?: ReadonlyArray<string>;
		readonly limit?: number;
		readonly offset?: number;
		readonly sortBy?: {
			readonly direction: "asc" | "desc";
			readonly field: string;
		};
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
