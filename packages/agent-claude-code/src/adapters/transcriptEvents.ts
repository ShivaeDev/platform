import type { SessionMessage, SessionStoreEntry } from "@anthropic-ai/claude-agent-sdk";
import type { RunEvent } from "@shivaedev/agent/events.ts";
import { blockEvent, contentBlocks } from "#adapters/blocks.ts";
import { claudeRaw } from "#adapters/rawPayload.ts";
import type { Origin } from "#protocol.ts";

const ROLES = { assistant: "agent", user: "user" } as const;
function roleOf(type: string): "agent" | "user" | undefined {
	return type === "assistant" || type === "user" ? ROLES[type] : undefined;
}
export function transcriptEvents(entry: SessionStoreEntry | SessionMessage, origin: Origin | undefined): readonly RunEvent[] {
	const raw = claudeRaw(`transcript/${entry.type}`, entry);
	const role = roleOf(entry.type);
	if (role === undefined) {
		return [{ raw, type: "raw" }];
	}
	const events = contentBlocks(entry)
		.map((block) => blockEvent(raw, role, block, origin))
		.filter((event): event is RunEvent => event !== undefined);
	return events.length === 0 ? [{ raw, type: "raw" }] : events;
}
