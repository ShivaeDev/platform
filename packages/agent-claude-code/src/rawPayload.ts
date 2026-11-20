import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { RawPayload } from "#protocol.ts";
export function claudeRaw(kind: string, payload: unknown): RawPayload {
	return {
		kind,
		payload: JSON.stringify(payload),
		source: "claude",
	};
}
export function rawOf(message: SDKMessage): RawPayload {
	const subtype = "subtype" in message && typeof message.subtype === "string" ? `/${message.subtype}` : "";
	return claudeRaw(`${message.type}${subtype}`, message);
}
