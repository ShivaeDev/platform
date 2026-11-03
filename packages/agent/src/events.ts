import { Schema } from "effect";
import { attribution, Cost, Gap, Raw, Usage } from "#eventData.ts";
import { ContentPart, ExecutionState, Receipt } from "#run.ts";

export const RunEvent = Schema.Union([
	Schema.Struct({ receipt: Receipt, type: Schema.Literal("acknowledged"), ...attribution }),
	Schema.Struct({ state: ExecutionState, type: Schema.Literal("execution"), ...attribution }),
	Schema.Struct({ reference: Schema.String, type: Schema.Literal("session.opened"), ...attribution }),
	Schema.Struct({
		inputId: Schema.optional(Schema.String),
		parts: Schema.Array(ContentPart),
		role: Schema.Literals(["agent", "user"]),
		type: Schema.Literal("message"),
		...attribution,
	}),
	Schema.Struct({ text: Schema.String, type: Schema.Literal("thinking"), ...attribution }),
	Schema.Struct({
		input: Schema.String,
		name: Schema.String,
		providerName: Schema.optional(Schema.String),
		toolId: Schema.String,
		type: Schema.Literal("tool.started"),
		...attribution,
	}),
	Schema.Struct({ ok: Schema.Boolean, output: Schema.String, toolId: Schema.String, type: Schema.Literal("tool.completed"), ...attribution }),
	Schema.Struct({
		approvalId: Schema.String,
		description: Schema.String,
		toolId: Schema.optional(Schema.String),
		type: Schema.Literal("approval.requested"),
		...attribution,
	}),
	Usage,
	Cost,
	Schema.Struct({ model: Schema.String, reason: Schema.optional(Schema.String), type: Schema.Literal("model.changed"), ...attribution }),
	Schema.Struct({
		charter: Schema.optional(Schema.String),
		childRef: Schema.String,
		label: Schema.optional(Schema.String),
		parentRef: Schema.optional(Schema.String),
		spawnedBy: Schema.String,
		type: Schema.Literal("child.opened"),
		...attribution,
	}),
	Schema.Struct({
		childRef: Schema.String,
		outcome: Schema.Literals(["completed", "failed", "interrupted", "unknown"]),
		summary: Schema.optional(Schema.String),
		type: Schema.Literal("child.ended"),
		...attribution,
	}),
	Schema.Struct({
		status: Schema.Literals(["allowed", "warning", "rejected", "unknown"]),
		type: Schema.Literal("rate.limit"),
		windows: Schema.Array(
			Schema.Struct({
				durationMinutes: Schema.optional(Schema.Number),
				model: Schema.optional(Schema.String),
				resetsAt: Schema.optional(Schema.Number),
				usedPercent: Schema.Number,
			}),
		),
		...attribution,
	}),
	Schema.Struct({
		tasks: Schema.Array(Schema.Struct({ description: Schema.String, id: Schema.String, kind: Schema.String })),
		type: Schema.Literal("session.background"),
		...attribution,
	}),
	Gap,
	Schema.Struct({ origin: attribution.origin, raw: Raw, type: Schema.Literal("raw") }),
]);
export type RunEvent = typeof RunEvent.Type;

export const Transcript = Schema.Struct({ completeness: Schema.Literals(["complete", "partial"]), events: Schema.Array(RunEvent) });
export type Transcript = typeof Transcript.Type;
