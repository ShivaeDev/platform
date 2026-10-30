import { Schema } from "effect";
import { Model } from "effect/schema";
import { PrefixedKey } from "./conflictModels.ts";

export class BatchReading extends Model.Class<BatchReading>("BatchReading")({
	amount: Schema.NumberFromString,
	id: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	label: Schema.String,
	note: Schema.optional(Schema.NullOr(Schema.String)),
	source: Schema.String,
}) {}

export class Measurement extends Model.Class<Measurement>("BatchMeasurement")({
	amount: Schema.NumberFromString,
	sequence: Schema.Int,
	source: PrefixedKey,
}) {}

export class Generated extends Model.Class<Generated>("BatchGenerated")({
	id: Model.Field({ json: Schema.Int, select: Schema.Int, update: Schema.Int }),
}) {}

export const WIDE_COLUMNS = Array.from({ length: 70 }, (_, index) => `field${index}`);

export class Wide extends Model.Class<Wide>("BatchWide")({
	...Object.fromEntries(WIDE_COLUMNS.map((column) => [column, Schema.Int])),
	id: Schema.Int,
}) {}

export interface ReadingInput {
	readonly amount: number;
	readonly label: string;
	readonly note?: string | null;
	readonly source: string;
}

export function meterReadings(size: number): ReadingInput[] {
	return Array.from({ length: size }, (_, index) => ({ amount: index, label: "original", source: `meter-${index}` }));
}
