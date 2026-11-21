import type { Raw } from "@shivaedev/agent/eventData.ts";
import type { RunEvent } from "@shivaedev/agent/events.ts";
import type { KnownItem } from "#protocolItems.ts";

function contentPart(part: Extract<KnownItem, { type: "userMessage" }>["content"][number]): Extract<RunEvent, { type: "message" }>["parts"][number] {
	if (part.type === "text") {
		return { text: part.text, type: "text" };
	}
	if (part.type === "localImage") {
		return { mediaType: "application/octet-stream", path: part.path, type: "image" };
	}
	return { kind: "image", payload: JSON.stringify(part), type: "native" };
}
export function userMessageEvent(item: Extract<KnownItem, { type: "userMessage" }>, raw: typeof Raw.Type): RunEvent {
	return {
		raw,
		role: "user",
		type: "message",
		...(item.clientId === null || item.clientId === undefined ? {} : { inputId: item.clientId }),
		parts: item.content.map(contentPart),
	};
}
