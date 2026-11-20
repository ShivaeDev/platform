import type { getSubagentMessages, listSubagents, Options, Query, SDKMessage, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { Context, Layer } from "effect";
import { loadClaudeSdk } from "#adapters/loadClaudeSdk.ts";
export class ClaudeProvider extends Context.Service<
	ClaudeProvider,
	{
		readonly query: (request: {
			readonly prompt: AsyncIterable<SDKUserMessage>;
			readonly options: Options;
		}) => AsyncIterable<SDKMessage> & Pick<Query, "interrupt" | "close">;
		readonly getSubagentMessages: typeof getSubagentMessages;
		readonly listSubagents: typeof listSubagents;
	}
>()("@shivaedev/agent-claude-code/ClaudeProvider") {
	static layer = Layer.effect(this, loadClaudeSdk);
}
