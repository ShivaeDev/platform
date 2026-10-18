import type { EngineInterface, ToolSpec } from "claude-code";

const NO_INPUT = { additionalProperties: false, properties: {}, type: "object" };

const SPECS: readonly ToolSpec[] = [
	{
		description:
			"Read-only: what needs you on the Work Board (count, titles and reasons), in-flight Fleet items with stage, time in stage, PR URL and the goal each implements, and goal progress done/total.",
		inputSchema: NO_INPUT,
		isDeferred: false,
		name: "board_overview",
	},
	{
		description: "Read-only: the Work Board's needs-you items, each with its reason, options, prompts, recommendation and age in milliseconds.",
		inputSchema: NO_INPUT,
		isDeferred: false,
		name: "needs_you",
	},
	{
		description: "Read-only: one Work Board item's computed status, owner, criteria, relationships, Fleet state and open decisions, by its id.",
		inputSchema: {
			additionalProperties: false,
			properties: { id: { description: "The item id, such as task.first", type: "string" } },
			required: ["id"],
			type: "object",
		},
		isDeferred: false,
		name: "item",
	},
];

export async function registerTools($: EngineInterface): Promise<void> {
	for (const spec of SPECS) {
		await $.tool.register(spec);
	}
}
