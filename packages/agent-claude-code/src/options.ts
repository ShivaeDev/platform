import type { Effect } from "effect";
export interface ClaudeTool {
	readonly call: (
		args: unknown,
		callId: string,
	) => Effect.Effect<{
		readonly text: string;
		readonly ok: boolean;
	}>;
	readonly description: string;
	readonly inputSchema: Readonly<Record<string, unknown>>;
	readonly name: string;
}
export interface ClaudeOptions {
	readonly executable?: string;
	readonly skills?: string;
	readonly systemPrompt?: string;
	readonly tools?: readonly ClaudeTool[];
}
