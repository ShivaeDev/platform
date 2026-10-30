import { Schema } from "effect";
import { Model } from "effect/schema";

export class Item extends Model.Class<Item>("ConstrainedItem")({
	id: Model.Field({ json: Schema.Number, select: Schema.Number, update: Schema.Number }),
	name: Schema.String,
	parentId: Schema.optional(Schema.NullOr(Schema.Number)),
	quantity: Schema.Number,
}) {}

export class NameTaken extends Schema.TaggedError<NameTaken>()("NameTaken", {}) {}
export class ParentMissing extends Schema.TaggedError<ParentMissing>()("ParentMissing", {}) {}
export class InvalidQuantity extends Schema.TaggedError<InvalidQuantity>()("InvalidQuantity", {}) {}
export class StorageUnavailable extends Schema.TaggedError<StorageUnavailable>()("StorageUnavailable", {}) {}
