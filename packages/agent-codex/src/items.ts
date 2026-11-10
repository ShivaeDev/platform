import type { Raw as RawSchema } from "@shivaedev/agent/eventData.ts";
import type { RunEvent as AgentEvent } from "@shivaedev/agent/events.ts";

type RawPayload = typeof RawSchema.Type;

import { Option, Schema } from "effect";
import { KnownItem } from "#protocolItems.ts";
import { userMessageEvent } from "#userMessageEvent.ts";

type Item<T extends KnownItem["type"]> = Extract<KnownItem, { type: T }>;

const decodeItem = Schema.decodeUnknownOption(KnownItem);

type Started = Extract<AgentEvent, { type: "tool.started" }>;

function toolIdentity(item: KnownItem): Pick<Started, "name" | "providerName"> {
	if (item.type === "mcpToolCall") {
		return { name: `${item.server}: ${item.tool}`, providerName: `${item.server}/${item.tool}` };
	}
	return item.type === "dynamicToolCall" ? { name: item.tool } : { name: item.type };
}

function toolInput(item: KnownItem): string {
	switch (item.type) {
		case "commandExecution":
			return item.command;
		case "dynamicToolCall":
			return JSON.stringify(item.arguments);
		case "fileChange":
			return item.changes.map((change) => change.path).join("\n");
		case "mcpToolCall":
			return JSON.stringify(item.arguments);
		case "webSearch":
			return item.query;
		default:
			return "";
	}
}

function isTool(
	item: KnownItem,
): item is Item<"commandExecution"> | Item<"dynamicToolCall"> | Item<"fileChange"> | Item<"mcpToolCall"> | Item<"webSearch"> {
	return (
		item.type === "commandExecution"
		|| item.type === "dynamicToolCall"
		|| item.type === "fileChange"
		|| item.type === "mcpToolCall"
		|| item.type === "webSearch"
	);
}

function commandOk(item: Item<"commandExecution">): boolean {
	return item.status === "completed" && (item.exitCode ?? 0) === 0;
}

function dynamicOutcome(item: Item<"dynamicToolCall">) {
	return {
		ok: item.success ?? item.status === "completed",
		output: (item.contentItems ?? []).map((part) => part.text ?? "").join("\n"),
	};
}

function toolOutcome(item: Item<"commandExecution" | "dynamicToolCall" | "fileChange" | "mcpToolCall" | "webSearch">): {
	ok: boolean;
	output: string;
} {
	switch (item.type) {
		case "commandExecution":
			return { ok: commandOk(item), output: item.aggregatedOutput ?? "" };
		case "dynamicToolCall":
			return dynamicOutcome(item);
		case "fileChange":
			return {
				ok: item.status === "completed",
				output: item.changes.map((change) => change.diff).join("\n"),
			};
		case "mcpToolCall":
			return {
				ok: item.status === "completed",
				output: JSON.stringify(item.error ?? item.result ?? null),
			};
		case "webSearch":
			return { ok: true, output: "" };
	}
}

function reasoningText(item: Item<"reasoning">): string {
	return [...(item.summary ?? []), ...(item.content ?? [])].join("\n");
}

function knownStarted(raw: RawPayload, item: KnownItem): AgentEvent[] {
	if (isTool(item)) {
		return [
			{
				input: toolInput(item),
				...toolIdentity(item),
				raw,
				toolId: item.id,
				type: "tool.started",
			},
		];
	}
	return item.type === "agentMessage" || item.type === "reasoning" || item.type === "userMessage" ? [] : [{ raw, type: "raw" }];
}

function knownCompleted(raw: RawPayload, item: KnownItem): AgentEvent[] {
	if (isTool(item)) {
		return [{ ...toolOutcome(item), raw, toolId: item.id, type: "tool.completed" }];
	}
	switch (item.type) {
		case "agentMessage":
			return [{ parts: [{ text: item.text, type: "text" }], raw, role: "agent", type: "message" }];
		case "userMessage":
			return [userMessageEvent(item, raw)];
		case "reasoning": {
			const text = reasoningText(item);
			return text.length === 0 ? [] : [{ raw, text, type: "thinking" }];
		}
		default:
			return [{ raw, type: "raw" }];
	}
}

function projectItem(project: (raw: RawPayload, item: KnownItem) => AgentEvent[]) {
	return (raw: RawPayload, item: unknown): AgentEvent[] =>
		Option.match(decodeItem(item), {
			onNone: () => [{ raw, type: "raw" }],
			onSome: (known) => project(raw, known),
		});
}

export const itemStarted = projectItem(knownStarted);
export const itemCompleted = projectItem(knownCompleted);
