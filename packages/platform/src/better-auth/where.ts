import { all, and, not, or } from "@shivaedev/effect-prisma";
import type { Where } from "better-auth";

export type CleanedWhere = Required<Where>;
export type Expression = Parameters<typeof and>[number];

export interface DynamicField {
	asc(): unknown;
	desc(): unknown;
	eq(value: unknown): Expression;
	gt(value: unknown): Expression;
	gte(value: unknown): Expression;
	ilike?(value: string): Expression;
	in(value: ReadonlyArray<unknown>): Expression;
	isNotNull(): Expression;
	isNull(): Expression;
	like(value: string): Expression;
	lt(value: unknown): Expression;
	lte(value: unknown): Expression;
	neq(value: unknown): Expression;
	notIn(value: ReadonlyArray<unknown>): Expression;
}

const escapeLike = (value: string): string => value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");

const nonNullValues = (value: unknown): ReadonlyArray<unknown> => (Array.isArray(value) ? value : [value]).filter((item) => item !== null);

const insensitiveStrings = (field: DynamicField, where: CleanedWhere, values: ReadonlyArray<unknown>) => {
	const ilike = field.ilike;
	if (where.mode !== "insensitive" || ilike === undefined || !values.every((item) => typeof item === "string")) {
		return undefined;
	}
	return values.map((item) => ilike(escapeLike(String(item))));
};

const membership = (field: DynamicField, where: CleanedWhere): Expression => {
	const values = nonNullValues(where.value);
	if (values.length === 0) {
		return and(field.isNull(), field.isNotNull());
	}
	const matches = insensitiveStrings(field, where, values);
	return matches === undefined ? field.in(values) : or(...matches);
};

const exclusion = (field: DynamicField, where: CleanedWhere): Expression | undefined => {
	const values = nonNullValues(where.value);
	if (values.length === 0) {
		return undefined;
	}
	const matches = insensitiveStrings(field, where, values);
	return matches === undefined ? field.notIn(values) : and(...matches.map((match) => not(match)));
};

const likePattern = (operator: CleanedWhere["operator"], escaped: string): string => {
	if (operator === "contains") return `%${escaped}%`;
	return operator === "starts_with" ? `${escaped}%` : `%${escaped}`;
};

const pattern = (field: DynamicField, where: CleanedWhere): Expression => {
	if (typeof where.value !== "string") {
		throw new TypeError(`${where.operator} requires a string value`);
	}
	const text = likePattern(where.operator, escapeLike(where.value));
	return where.mode === "insensitive" && field.ilike !== undefined ? field.ilike(text) : field.like(text);
};

const insensitiveEquality = (field: DynamicField, where: CleanedWhere): Expression | undefined => {
	const value = where.value;
	const operator = where.operator ?? "eq";
	if (where.mode !== "insensitive" || typeof value !== "string" || field.ilike === undefined) return undefined;
	if (operator === "eq") return field.ilike(escapeLike(value));
	if (operator === "ne") return not(field.ilike(escapeLike(value)));
	return undefined;
};

const comparison = (field: DynamicField, where: CleanedWhere): Expression | undefined => {
	const value = where.value;
	switch (where.operator ?? "eq") {
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
		case "in":
			return membership(field, where);
		case "not_in":
			return exclusion(field, where);
		case "contains":
		case "starts_with":
		case "ends_with":
			return pattern(field, where);
	}
};

export const whereExpression = (fields: Record<string, DynamicField>, where: ReadonlyArray<CleanedWhere>): Expression | undefined => {
	const conjunctions: Expression[] = [];
	const disjunctions: Expression[] = [];

	for (const condition of where) {
		const field = fields[condition.field];
		if (field === undefined) {
			throw new TypeError(`Unknown database field: ${condition.field}`);
		}
		const expression = insensitiveEquality(field, condition) ?? comparison(field, condition);
		if (expression === undefined) continue;
		(condition.connector === "OR" ? disjunctions : conjunctions).push(expression);
	}

	if (disjunctions.length > 0) conjunctions.push(or(...disjunctions));
	if (conjunctions.length === 0) return all();
	return conjunctions.length === 1 ? conjunctions[0] : and(...conjunctions);
};
