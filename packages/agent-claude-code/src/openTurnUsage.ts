import type { ModelUsage, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { RunEvent } from "@shivaedev/agent/events.ts";
import type { RawPayload } from "#protocol.ts";

function step(now: number, before: number) {
	return now < before ? now : now - before;
}
export function openTurnUsage() {
	const previous = new Map<string, ModelUsage>();
	return {
		usage: (
			raw: RawPayload,
			message: Extract<
				SDKMessage,
				{
					type: "result";
				}
			>,
		): readonly RunEvent[] =>
			Object.entries(message.modelUsage).flatMap(([key, now]): RunEvent[] => {
				if (now.inputTokens + now.outputTokens + now.cacheReadInputTokens + now.cacheCreationInputTokens + now.costUSD === 0) {
					return [];
				}
				const before = previous.get(key);
				previous.set(key, now);
				const model = now.canonicalModel ?? key;
				return [
					{
						cacheReadTokens: step(now.cacheReadInputTokens, before?.cacheReadInputTokens ?? 0),
						cacheWriteTokens: step(now.cacheCreationInputTokens, before?.cacheCreationInputTokens ?? 0),
						inputTokens: step(now.inputTokens, before?.inputTokens ?? 0),
						model,
						outputTokens: step(now.outputTokens, before?.outputTokens ?? 0),
						raw,
						scope: "delta",
						type: "usage",
						unit: "turn",
					},
					{
						amount: step(now.costUSD, before?.costUSD ?? 0),
						currency: "USD",
						model,
						raw,
						scope: "delta",
						source: "provider",
						type: "cost",
						unit: "turn",
					},
				];
			}),
	};
}
