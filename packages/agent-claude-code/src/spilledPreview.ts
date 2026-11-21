import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { RunEvent } from "@shivaedev/agent/events.ts";
import { isRecord } from "#blocks.ts";
import type { Origin, RawPayload } from "#protocol.ts";
// Oversized tool results carry only a preview inline and name the stored full output in `persistedOutputPath`.
export function spilledPreview(raw: RawPayload, message: SDKMessage, origin: Origin | undefined): readonly RunEvent[] {
	if (!("tool_use_result" in message && isRecord(message.tool_use_result))) {
		return [];
	}
	const spill = message.tool_use_result;
	if (typeof spill.persistedOutputPath !== "string") {
		return [];
	}
	const size = typeof spill.persistedOutputSize === "number" ? ` (${spill.persistedOutputSize} bytes)` : "";
	return [
		{
			detail: `full tool output spilled to ${spill.persistedOutputPath}${size}`,
			kind: "spilled-preview",
			...(origin === undefined ? {} : { origin }),
			raw,
			type: "gap",
		},
	];
}
