import type { Effect } from "effect";
export interface ToolOutcome {
	readonly ok: boolean;
	readonly text: string;
}
export interface ToolDefinition {
	readonly description: string;
	readonly inputSchema: Readonly<Record<string, unknown>>;
	readonly name: string;
}
export interface DirectTool extends ToolDefinition {
	readonly call: (callId: string, args: unknown) => Effect.Effect<ToolOutcome>;
}
