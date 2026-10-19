import { Schema } from "effect";
import { CompletedFleetItem, FleetItem } from "#diagnostics/fleetItems.ts";
import { Metadata } from "#metadata/schema.ts";

const AuthoredProgress = Schema.Struct({ file: Schema.String, status: Schema.String, title: Schema.String, workId: Schema.String });
export type AuthoredProgress = typeof AuthoredProgress.Type;
const FleetDocument = Schema.NullOr(Schema.Struct({ file: Schema.String, metadata: Metadata, title: Schema.String }));
export const FleetItemsProjection = Schema.Union([
	Schema.Struct({
		completed: Schema.Array(Schema.Struct({ ...CompletedFleetItem.fields, document: FleetDocument })),
		items: Schema.Array(Schema.Struct({ ...FleetItem.fields, document: FleetDocument, readyToMerge: Schema.optionalKey(Schema.Boolean) })),
		state: Schema.Literal("ready"),
	}),
	Schema.Struct({
		authored: Schema.optional(Schema.Array(AuthoredProgress)),
		reason: Schema.String,
		startCommand: Schema.optionalKey(Schema.String),
		state: Schema.Literal("unavailable"),
	}),
]);
export type FleetItemsProjection = typeof FleetItemsProjection.Type;
