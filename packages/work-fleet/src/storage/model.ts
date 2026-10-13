import { Effect, Schema, SchemaAST } from "effect";
import { Model } from "effect/schema";
import { FleetRecord } from "#model.ts";
import { recordValue } from "#storage/recordValue.ts";
export interface Versioned<A> {
	readonly value: A;
	readonly version: number;
}

export interface AdmissionLimits {
	readonly maxBacklog?: number;
	readonly maxExecuting?: number;
	readonly quota?: { readonly observedAt: number; readonly available: number };
	readonly scheduling?: { readonly now: number; readonly areaMergeWaitMs: number };
}

function scalarKind(ast: SchemaAST.AST): "string" | "number" | "boolean" | "json" {
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
		if (typeof ast.literal === "string") {
			return "string";
		}
		if (typeof ast.literal === "number") {
			return "number";
		}
		if (typeof ast.literal === "boolean") {
			return "boolean";
		}
	}
	if (SchemaAST.isUnion(ast)) {
		const kinds = new Set(ast.types.filter((type) => !SchemaAST.isUndefined(type)).map(scalarKind));
		if (kinds.size === 1) {
			return [...kinds][0] ?? "json";
		}
	}
	return "json";
}

export function recordColumns(schema: Schema.Top = FleetRecord) {
	const ast = SchemaAST.toEncoded(schema.ast);
	const base = SchemaAST.toEncoded(FleetRecord.ast);
	const properties = [...(SchemaAST.isObjects(base) ? base.propertySignatures : []), ...(SchemaAST.isObjects(ast) ? ast.propertySignatures : [])];
	return Object.fromEntries(properties.filter((field) => field.name !== "workId").map((field) => [String(field.name), scalarKind(field.type)]));
}

function columnSchema(kind: string) {
	if (kind === "number") {
		return Schema.Number;
	}
	if (kind === "boolean") {
		return Schema.Boolean;
	}
	return Schema.String;
}

const rowFields = {
	"admission_order": Model.Field({ select: Schema.BigIntFromString, update: Schema.BigIntFromString }),
	attempts: Schema.NullOr(Schema.String),
	attentionOwner: Schema.NullOr(Schema.String),
	blocker: Schema.NullOr(Schema.String),
	checks: Schema.NullOr(Schema.String),
	decision: Schema.NullOr(Schema.String),
	history: Schema.NullOr(Schema.String),
	launchRetry: Schema.NullOr(Schema.String),
	outcome: Schema.NullOr(Schema.String),
	stage: Schema.NullOr(Schema.String),
	version: Model.Field({ select: Schema.Number, update: Schema.Number }),
	"work_id": Schema.String,
};
class FleetRow extends Model.Class<FleetRow>("FleetRow")(rowFields) {}

export function recordModel(schema: Schema.Top = FleetRecord): typeof FleetRow {
	const fields = Object.fromEntries(Object.entries(recordColumns(schema)).map(([name, kind]) => [name, Schema.NullOr(columnSchema(kind))]));
	// Explicit summary fields retain typed projections while the remaining fields come from the record schema.
	class RecordRow extends Model.Class<RecordRow>("FleetRow")({ ...rowFields, ...fields }) {}
	return RecordRow;
}

export const ForeignReservation = Schema.Struct({
	backlog: Schema.Boolean,
	executing: Schema.Boolean,
	owner: Schema.String,
});
export type ForeignReservation = typeof ForeignReservation.Type;

export class ForeignReservationRow extends Model.Class<ForeignReservationRow>("ForeignReservationRow")(ForeignReservation.fields) {}

export function recordInput(value: string | object, columns: ReturnType<typeof recordColumns>) {
	const encoded: Record<string, unknown> = typeof value === "string" ? JSON.parse(value) : { ...value };
	return Object.fromEntries(
		Object.entries(columns).map(([name, kind]) => {
			if (encoded[name] === undefined) {
				return [name, null];
			}
			return [name, kind === "json" ? JSON.stringify(encoded[name]) : encoded[name]];
		}),
	);
}

export function recordJson(row: object, columns: ReturnType<typeof recordColumns>) {
	return recordValue(row, columns).pipe(Effect.map(JSON.stringify));
}

export interface StoredRow {
	readonly value: string;
	readonly version: number;
}
