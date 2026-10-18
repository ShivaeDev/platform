import * as PgTypes from "@effect/sql-pg/PgTypes";
import { Effect, Result, Schema, SchemaGetter } from "effect";
import { Model } from "effect/schema";
import { FleetRecord } from "#model.ts";
import { inputColumns } from "#storage/recordChildren.ts";
import { type ColumnKind, columnSchema, recordShape, shapeColumns } from "#storage/recordShape.ts";
import { recordValue } from "#storage/recordValue.ts";
export interface Versioned<A> {
	readonly value: A;
	readonly version: number;
}

export interface OpenPullRequestCurve {
	readonly ease: number;
	readonly floor: number;
	readonly max: number;
}

export interface AdmissionLimits {
	readonly implementers?: { readonly concurrency: number; readonly openPullRequests?: OpenPullRequestCurve };
	readonly maxBacklog?: number;
	readonly maxExecuting?: number;
	readonly quota?: { readonly observedAt: number; readonly available: number };
	readonly scheduling?: { readonly now: number; readonly areaMergeWaitMs: number; readonly waiters: readonly string[] };
}

export function recordColumns(schema: Schema.Top = FleetRecord) {
	return shapeColumns(recordShape(schema));
}

const rowFields = {
	"admission_order": Model.Field({ select: Schema.BigInt, update: Schema.BigInt }),
	attempts: Schema.NullOr(Schema.Boolean),
	attentionOwner: Schema.NullOr(Schema.String),
	blocker: Schema.NullOr(Schema.String),
	checks: Schema.NullOr(Schema.Boolean),
	decision: Schema.NullOr(Schema.Boolean),
	history: Schema.NullOr(Schema.Boolean),
	launchRetry: Schema.NullOr(Schema.Boolean),
	outcome: Schema.NullOr(Schema.Boolean),
	stage: Schema.NullOr(Schema.String),
	version: Model.Field({ select: Schema.Number, update: Schema.Number }),
	"work_id": Schema.String,
};
class FleetRow extends Model.Class<FleetRow>("FleetRow")(rowFields) {}

export function recordModel(schema: Schema.Top = FleetRecord): typeof FleetRow {
	return modelFromColumns(recordColumns(schema));
}

export function modelFromColumns(columns: Readonly<Record<string, ColumnKind>>): typeof FleetRow {
	const fields = Object.fromEntries(Object.entries(columns).map(([name, kind]) => [name, columnSchema(kind)]));
	// Explicit summary fields retain typed projections while the remaining fields come from the record schema.
	class RecordRow extends Model.Class<RecordRow>("FleetRow")({ ...rowFields, ...fields }) {}
	return RecordRow;
}

export const ForeignReservation = Schema.Struct({
	areas: Schema.Array(Schema.String),
	backlog: Schema.Boolean,
	executing: Schema.Boolean,
	owner: Schema.String,
});
export type ForeignReservation = typeof ForeignReservation.Type;

const StoredAreas = Schema.Unknown.pipe(
	Schema.decodeTo(ForeignReservation.fields.areas, {
		decode: SchemaGetter.transformEffect((value) =>
			Schema.decodeUnknownEffect(ForeignReservation.fields.areas)(PgTypes.isParameter(value) ? value.value : value).pipe(
				Effect.mapError((error) => error.issue),
			),
		),
		encode: SchemaGetter.transform((areas) => Result.getOrThrow(PgTypes.array(areas, PgTypes.OID.text))),
	}),
);

export class ForeignReservationRow extends Model.Class<ForeignReservationRow>("ForeignReservationRow")({
	...ForeignReservation.fields,
	areas: Model.Field({ insert: StoredAreas, json: ForeignReservation.fields.areas, select: StoredAreas, update: StoredAreas }),
}) {}

export function recordInput(value: object, schema: Schema.Top = FleetRecord) {
	return inputColumns(value, recordShape(schema));
}

export function recordJson(row: object, namespace: string) {
	return recordValue(row, recordShape(), namespace).pipe(Effect.map(JSON.stringify));
}
