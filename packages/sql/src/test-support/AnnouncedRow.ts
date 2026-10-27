import { Schema } from "effect";
import { Model } from "effect/schema";

export class AnnouncedRow extends Model.Class<AnnouncedRow>("AnnouncedRow")({
	id: Schema.Number,
	parent: Schema.NullOr(Schema.Number),
}) {}
