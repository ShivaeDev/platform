import * as PgTypes from "@effect/sql-pg/PgTypes";
import { BigDecimal, Result, Schema, SchemaGetter, SchemaParser } from "effect";
import { Model } from "effect/schema";

const Integers = Schema.Array(Schema.Int);
const StoredIntegers = Schema.Unknown.pipe(
	Schema.decodeTo(Integers, {
		decode: SchemaGetter.transformEffect((value) => SchemaParser.decodeUnknownEffect(Integers)(PgTypes.isParameter(value) ? value.value : value)),
		encode: SchemaGetter.transform((values) => Result.getOrThrow(PgTypes.array(values, PgTypes.OID.int4))),
	}),
);

export class Sample extends Model.Class<Sample>("QuerySample")({
	id: Schema.Int,
	values: Model.Field({ insert: StoredIntegers, json: Integers, select: StoredIntegers, update: StoredIntegers }),
}) {}

export class Payment extends Model.Class<Payment>("QueryPayment")({
	amount: Schema.BigDecimalFromString,
	"due_on": Schema.String,
	id: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	note: Schema.NullOr(Schema.String),
	sequence: Schema.BigInt,
	"settled_at": Schema.Date,
}) {}

export class UtcPayment extends Model.Class<UtcPayment>("QueryUtcPayment")({
	id: Schema.Int,
	"settled_at": Schema.DateTimeUtcFromDate,
}) {}

export const payment = {
	amount: BigDecimal.fromStringUnsafe("9007199254740993.123456789012"),
	"due_on": "2026-09-30",
	note: null,
	sequence: 9007199254740993n,
	"settled_at": new Date("2026-09-19T10:11:12.345Z"),
};

export class InvoiceLine extends Model.Class<InvoiceLine>("QueryInvoiceLine")({
	amount: Schema.NumberFromString,
	id: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	name: Schema.String,
	note: Schema.NullOr(Schema.String),
}) {}

export class SourceRow extends Model.Class<SourceRow>("QuerySourceRow")({
	amount: Schema.NumberFromString,
	displayName: Schema.String,
	sourceKey: Schema.Int,
	status: Schema.String,
}) {}

export class CopiedRow extends Model.Class<CopiedRow>("QueryCopiedRow")({
	amount: Schema.NumberFromString,
	copiedKey: Schema.Int,
	createdAt: Model.Field({ json: Schema.DateFromString, select: Schema.Date }),
	id: Model.Field({ json: Schema.Int, select: Schema.Int, update: Schema.Int }),
	name: Schema.String,
}) {}

export const copyColumns = { amount: "amount", copiedKey: "sourceKey", name: "displayName" } as const;

export class PartialRow extends Model.Class<PartialRow>("QueryPartialRow")({
	a: Schema.String,
	b: Schema.NumberFromString,
	id: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	kind: Schema.String.pipe(
		Schema.decodeTo(Schema.String, {
			decode: SchemaGetter.transform((value: string) => value.toUpperCase()),
			encode: SchemaGetter.transform((value: string) => value.toLowerCase()),
		}),
	),
	value: Schema.Number,
}) {}

export class LedgerEntry extends Model.Class<LedgerEntry>("QueryLedgerEntry")({
	account: Schema.String,
	amount: Schema.String,
	sequence: Schema.BigInt,
}) {}

export class TestResult extends Model.Class<TestResult>("QueryTestResult")({
	durationMs: Schema.Int,
	failed: Schema.NullOr(Schema.Boolean),
	file: Schema.String,
	id: Schema.Int,
	project: Schema.String,
	weight: Schema.NullOr(Schema.BigDecimalFromString),
}) {}

export class LatestRun extends Model.Class<LatestRun>("QueryLatestRun")({
	id: Schema.Int,
	repository: Schema.NumberFromString.check(Schema.isInt()),
	status: Schema.String,
	workflow: Schema.NullOr(Schema.String),
}) {}
