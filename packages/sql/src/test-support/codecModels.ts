import * as PgTypes from "@effect/sql-pg/PgTypes";
import { BigDecimal, Result, Schema, SchemaGetter, SchemaParser } from "effect";
import { Model } from "effect/schema";

export class Payment extends Model.Class<Payment>("Payment")({
	amount: Schema.BigDecimalFromString,
	"created_at": Model.Field({ json: Schema.DateFromString, select: Schema.Date }),
	"due_on": Schema.String,
	id: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	"local_time": Schema.Date,
	note: Schema.NullOr(Schema.String),
	sequence: Schema.BigInt,
	"settled_at": Schema.Date,
}) {}

export const PRECISE_AMOUNT = "9007199254740993.123456789012";
export const BEYOND_NUMBER = 9_007_199_254_740_993n;

export const payment = {
	amount: BigDecimal.fromStringUnsafe(PRECISE_AMOUNT),
	"due_on": "2026-09-30",
	"local_time": new Date("2026-09-19T10:11:12.345Z"),
	note: null,
	sequence: BEYOND_NUMBER,
	"settled_at": new Date("2026-09-19T10:11:12.345Z"),
};

export class Receipt extends Model.Class<Receipt>("Receipt")({
	details: Schema.Struct({ attempts: Schema.Int, channel: Schema.String }),
	id: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
}) {}

const Integers = Schema.Array(Schema.Int);
const StoredIntegers = Schema.Unknown.pipe(
	Schema.decodeTo(Integers, {
		decode: SchemaGetter.transformEffect((value) => SchemaParser.decodeUnknownEffect(Integers)(PgTypes.isParameter(value) ? value.value : value)),
		encode: SchemaGetter.transform((values) => Result.getOrThrow(PgTypes.array(values, PgTypes.OID.int4))),
	}),
);

export class Sample extends Model.Class<Sample>("Sample")({
	id: Schema.Int,
	values: Model.Field({ insert: StoredIntegers, json: Integers, select: StoredIntegers, update: StoredIntegers }),
}) {}
