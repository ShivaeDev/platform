import { Context, type Effect } from "effect";
export interface DynamicTool {
	readonly description: string;
	readonly execute: (input: unknown, callId: string) => Effect.Effect<{ readonly ok: boolean; readonly text: string }>;
	readonly inputSchema: unknown;
	readonly name: string;
}
export interface CodexConfiguration {
	readonly args?: readonly string[];
	readonly baseInstructions?: string;
	readonly command?: string;
	readonly cwd?: string;
	readonly requestTimeoutMs?: number;
	readonly sandbox?: "read-only" | "workspace-write" | "danger-full-access";
	readonly tools?: readonly DynamicTool[];
}
export class CodexConfig extends Context.Service<CodexConfig, CodexConfiguration>()("@shivaedev/agent-codex/CodexConfig") {}
