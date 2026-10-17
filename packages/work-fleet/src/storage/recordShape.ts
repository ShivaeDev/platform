import * as PgTypes from "@effect/sql-pg/PgTypes";
import { Effect, Result, Schema, SchemaAST, SchemaGetter } from "effect";
import { FleetRecord } from "#model.ts";

export type ScalarKind = "string" | "number" | "boolean";
export type Shape = ScalarKind | { readonly array: Shape } | { readonly fields: Readonly<Record<string, Shape>> };
export type ColumnKind = ScalarKind | "string[]" | "number[]" | "boolean[]";

function flatten(ast: SchemaAST.AST): readonly SchemaAST.AST[] {
	return SchemaAST.isUnion(ast) ? ast.types.flatMap(flatten) : [ast];
}

function fromAsts(asts: readonly SchemaAST.AST[]): Shape {
	const types = asts.flatMap(flatten).filter((ast) => !SchemaAST.isUndefined(ast));
	if (types.every(SchemaAST.isObjects)) {
		const names = [...new Set(types.flatMap((ast) => ast.propertySignatures.map((field) => String(field.name))))];
		return {
			fields: Object.fromEntries(
				names.map((name) => [
					name,
					fromAsts(types.flatMap((ast) => ast.propertySignatures.filter((field) => field.name === name).map((field) => field.type))),
				]),
			),
		};
	}
	if (types.every(SchemaAST.isArrays)) {
		return { array: fromAsts(types.flatMap((ast) => ast.rest)) };
	}
	const kinds = types.map((ast) => {
		if (SchemaAST.isString(ast)) {
			return "string";
		}
		if (SchemaAST.isNumber(ast)) {
			return "number";
		}
		if (SchemaAST.isBoolean(ast)) {
			return "boolean";
		}
		if (SchemaAST.isLiteral(ast)) {
			return typeof ast.literal;
		}
		throw new Error(`Unsupported Fleet storage schema: ${ast._tag}`);
	});
	const kind = kinds[0];
	if ((kind === "string" || kind === "number" || kind === "boolean") && kinds.every((value) => value === kind)) {
		return kind;
	}
	throw new Error("Fleet storage requires a single typed column kind");
}

export function schemaShape(schema: Schema.Top): Shape {
	const shape = fromAsts([SchemaAST.toEncoded(schema.ast)]);
	if (typeof shape === "object" && "fields" in shape) {
		const { workId: _workId, ...fields } = shape.fields;
		return { fields };
	}
	throw new Error("Fleet records must be objects");
}

export function recordShape(schema: Schema.Top = FleetRecord): Shape {
	const base = schemaShape(FleetRecord);
	const extra = schemaShape(schema);
	if (typeof base === "object" && "fields" in base && typeof extra === "object" && "fields" in extra) {
		return { fields: { ...base.fields, ...extra.fields } };
	}
	throw new Error("Fleet records must be objects");
}

export function shapeColumns(shape: Shape, prefix: readonly string[] = []): Record<string, ColumnKind> {
	const name = prefix.join("__");
	if (typeof shape === "string") {
		return { [name]: shape };
	}
	if ("array" in shape) {
		if (typeof shape.array !== "string") {
			return { [name]: "boolean" };
		}
		const kinds = { boolean: "boolean[]", number: "number[]", string: "string[]" } as const;
		return { [name]: kinds[shape.array] };
	}
	return Object.assign(
		prefix.length === 0 ? {} : { [name]: "boolean" },
		...Object.entries(shape.fields).map(([key, field]) => shapeColumns(field, [...prefix, key])),
	);
}

export interface Collection {
	readonly parents: readonly string[];
	readonly path: readonly string[];
	readonly shape: Shape;
}

export function collections(shape: Shape, path: readonly string[] = [], parents: readonly string[] = []): Collection[] {
	if (typeof shape === "string") {
		return [];
	}
	if ("array" in shape) {
		if (typeof shape.array === "string") {
			return [];
		}
		return [{ parents, path, shape: shape.array }, ...collections(shape.array, path, [...parents, path.join(".")])];
	}
	return Object.entries(shape.fields).flatMap(([key, field]) => collections(field, [...path, key], parents));
}

export const sqlTypes: Readonly<Record<ColumnKind, string>> = {
	boolean: "boolean",
	"boolean[]": "boolean[]",
	number: "double precision",
	"number[]": "double precision[]",
	string: "text",
	"string[]": "text[]",
};

function scalarCodec(kind: ColumnKind) {
	if (kind.startsWith("number")) {
		return { oid: PgTypes.OID.float8, schema: Schema.Number };
	}
	if (kind.startsWith("boolean")) {
		return { oid: PgTypes.OID.bool, schema: Schema.Boolean };
	}
	return { oid: PgTypes.OID.text, schema: Schema.String };
}

export function columnSchema(kind: ColumnKind): Schema.Top & { readonly DecodingServices: never; readonly EncodingServices: never } {
	const { schema: Scalar, oid } = scalarCodec(kind);
	if (!kind.endsWith("[]")) {
		return Schema.NullOr(Scalar);
	}
	const ArrayValue = Schema.NullOr(Schema.Array(Scalar));
	return Schema.Unknown.pipe(
		Schema.decodeTo(ArrayValue, {
			decode: SchemaGetter.transformEffect((value) => Schema.decodeUnknownEffect(ArrayValue)(value).pipe(Effect.mapError((error) => error.issue))),
			encode: SchemaGetter.transform((values) => (values === null ? null : Result.getOrThrow(PgTypes.array(values, oid)))),
		}),
	);
}
