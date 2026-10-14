import { Schema } from "effect";
import { CompletedFleetItem, FleetItem } from "#diagnostics/fleetItems.ts";
import { Metadata } from "#metadata/schema.ts";

const FleetDocument = Schema.NullOr(Schema.Struct({ file: Schema.String, metadata: Metadata, title: Schema.String }));
export const FleetItemsProjection = Schema.Union([
	Schema.Struct({
		completed: Schema.Array(Schema.Struct({ ...CompletedFleetItem.fields, document: FleetDocument })),
		items: Schema.Array(Schema.Struct({ ...FleetItem.fields, document: FleetDocument })),
		state: Schema.Literal("ready"),
	}),
	Schema.Struct({ reason: Schema.String, state: Schema.Literal("unavailable") }),
]);
export type FleetItemsProjection = typeof FleetItemsProjection.Type;
