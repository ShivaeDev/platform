import { Schema, SchemaGetter } from "effect";
import { Model } from "effect/schema";

const Version = Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number });

export class Document extends Model.Class<Document>("VersionedDocument")({
	id: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	lockVersion: Version,
	name: Schema.String,
}) {}

export class OwnedRow extends Model.Class<OwnedRow>("OwnedRow")({
	id: Schema.NumberFromString,
	lockVersion: Version,
	name: Schema.String,
	ownerId: Schema.NumberFromString,
}) {}

const DoubledVersion = Schema.Number.pipe(
	Schema.decodeTo(Schema.Number, {
		decode: SchemaGetter.transform((value) => value * 2),
		encode: SchemaGetter.transform((value) => value / 2),
	}),
);

export class CodedRow extends Model.Class<CodedRow>("CodedRow")({
	id: Schema.NumberFromString,
	lockVersion: Model.Field({ json: DoubledVersion, select: DoubledVersion, update: DoubledVersion }),
	name: Schema.String,
	ownerId: Schema.NumberFromString,
}) {}
