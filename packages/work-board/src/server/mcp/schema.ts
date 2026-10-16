import { Schema } from "effect";
import { DocumentRequest } from "#browser/document/schema.ts";
import { FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";
import { GoalsProjection } from "#browser/views/GoalsProjection.ts";
import { InboxProjection } from "#browser/views/schema.ts";
import { FleetItem } from "#diagnostics/fleetItems.ts";
import { Metadata } from "#metadata/schema.ts";

const YouItem = Schema.Struct({
	...InboxProjection.fields.you.value.fields,
	ageMs: Schema.NullOr(Schema.Number),
	options: Schema.required(Metadata.to.fields.options),
	prompts: Schema.required(DocumentRequest.fields.prompts),
	promptUnavailable: DocumentRequest.fields.promptUnavailable,
	recommended: Metadata.to.fields.recommended,
});
const Needs = Schema.Struct({
	complete: Schema.Boolean,
	issues: InboxProjection.fields.issues,
	you: Schema.Array(YouItem),
});
export const NeedsYou = Schema.toCodecJson(Needs);
export const Overview = Schema.toCodecJson(
	Schema.Struct({
		fleet: Schema.Union([
			Schema.Struct({ items: FleetItemsProjection.members[0].fields.items, state: Schema.Literal("ready") }),
			FleetItemsProjection.members[1],
		]),
		goals: Schema.Struct({ closedGoals: GoalsProjection.fields.closedGoals, goals: GoalsProjection.fields.goals }),
		needsYou: Schema.Struct({ ...Needs.fields, count: Schema.Number }),
	}),
);
export const Item = Schema.toCodecJson(
	Schema.Struct({
		criteria: Schema.required(Metadata.to.fields.criteria),
		fleet: Schema.Union([
			Schema.Struct({ item: Schema.NullOr(FleetItem), state: Schema.Literal("ready") }),
			Schema.Struct({ reason: Schema.String, state: Schema.Literal("unavailable") }),
		]),
		id: Schema.String,
		openDecisions: Schema.Array(DocumentRequest),
		owner: Schema.optional(Schema.String),
		relationships: Schema.required(Metadata.to.fields.relationships),
		status: Schema.optional(Schema.String),
	}),
);
