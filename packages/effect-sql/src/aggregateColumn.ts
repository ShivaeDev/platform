import { Effect, Schema, SchemaAST } from "effect";
import type { SqlClient } from "effect/sql";

const Expression = Schema.Tuple([Schema.Tuple([Schema.Literals(["count", "sum", "avg", "min", "max", "boolOr", "boolAnd"]), Schema.String])]);
const functions = { avg: "avg", boolAnd: "bool_and", boolOr: "bool_or", count: "count", max: "max", min: "min", sum: "sum" };
type Operation = keyof typeof functions;

function isNumber(ast: SchemaAST.AST): boolean {
	if (ast._tag === "Union") {
		return ast.types.some(isNumber);
	}
	if (ast._tag === "Suspend") {
		return isNumber(ast.thunk());
	}
	return ast._tag === "Number" || (ast._tag === "Literal" && typeof ast.literal === "number");
}

function resultSchema(operation: Operation, field: Schema.Constraint): Schema.Constraint {
	switch (operation) {
		case "count":
			return Schema.NumberFromString;
		case "sum":
		case "avg":
			return isNumber(SchemaAST.toType(field.ast)) ? Schema.NumberFromString : Schema.BigDecimalFromString;
		case "boolOr":
		case "boolAnd":
			return Schema.Boolean;
		case "min":
		case "max":
			return field;
	}
}

export function aggregateColumn(sql: SqlClient.SqlClient, fieldAt: (key: string) => Effect.Effect<Schema.Constraint, Schema.SchemaError>) {
	return Effect.fnUntraced(function* (name: string, expression: object) {
		const [[operation, key]] = yield* Schema.decodeUnknownEffect(Expression)(Object.entries(expression));
		const countRows = operation === "count" && key === "*";
		const field = countRows ? Schema.Number : yield* fieldAt(key);
		const operand = countRows ? sql`*` : sql`${sql(key)}`;
		const aggregate = sql`${sql.literal(functions[operation])}(${operand})`;
		const text = operation === "count" || operation === "sum" || operation === "avg";
		const Result = resultSchema(operation, field);
		return {
			column: sql`${text ? sql`cast(${aggregate} as text)` : aggregate} as ${sql(name)}`,
			order: aggregate,
			schema: operation === "count" ? Result : Schema.NullOr(Result),
		};
	});
}
