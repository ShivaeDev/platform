import type { Raw } from "@shivaedev/agent/eventData.ts";
import type { RunEvent as AgentEvent } from "@shivaedev/agent/events.ts";

type RawPayload = typeof Raw.Type;

import { Option, Schema } from "effect";
import { rawEvent } from "#mapping.ts";
import type { MessageAuthor, MessageAuthors } from "#messageAuthors.ts";
import { KnownPart, PartUpdatedProperties } from "#protocolParts.ts";
import { toolEvents } from "#toolEvents.ts";

const decodeProperties = Schema.decodeUnknownOption(PartUpdatedProperties);
const decodePart = Schema.decodeUnknownOption(KnownPart);
type Settled = Extract<
	KnownPart,
	{
		type: "reasoning" | "text";
	}
>;
function isSettled(part: Settled, author: MessageAuthor): boolean {
	return author.role === "user" || part.time?.end !== undefined;
}
function spokenEvents(raw: RawPayload, part: Settled, author: MessageAuthor): AgentEvent[] {
	return part.type === "reasoning"
		? [{ raw, text: part.text, type: "thinking" }]
		: [{ parts: [{ text: part.text, type: "text" }], raw, role: author.role, type: "message" }];
}
function usageEvents(
	raw: RawPayload,
	part: Extract<
		KnownPart,
		{
			type: "step-finish";
		}
	>,
	author: MessageAuthor,
): AgentEvent[] {
	const model = author.model === undefined ? {} : { model: author.model };
	const counted = {
		...(part.tokens.cache?.read === undefined ? {} : { cacheReadTokens: part.tokens.cache.read }),
		...(part.tokens.cache?.write === undefined ? {} : { cacheWriteTokens: part.tokens.cache.write }),
		inputTokens: part.tokens.input,
		outputTokens: part.tokens.output,
	};
	return [
		{ ...counted, ...model, raw, scope: "delta", type: "usage", unit: "turn" },
		...(part.cost === undefined
			? []
			: [
					{
						amount: part.cost,
						currency: "USD",
						...model,
						raw,
						scope: "delta" as const,
						source: "provider" as const,
						type: "cost" as const,
						unit: "turn" as const,
					},
				]),
	];
}
function authoredEvents(raw: RawPayload, part: KnownPart, author: MessageAuthor, firstReport: (key: string) => boolean): AgentEvent[] {
	if (part.type === "tool") {
		return toolEvents(raw, part, (callId) => firstReport(`${part.state.status}:${callId}`));
	}
	if (part.type === "step-finish") {
		return firstReport(`part:${part.id}`) ? usageEvents(raw, part, author) : [];
	}
	return isSettled(part, author) && firstReport(`part:${part.id}`) ? spokenEvents(raw, part, author) : [];
}
export function partEvents(raw: RawPayload, properties: unknown, authors: MessageAuthors, firstReport: (key: string) => boolean): AgentEvent[] {
	return Option.match(decodeProperties(properties), {
		onNone: () => rawEvent(raw),
		onSome: ({ part }) =>
			Option.match(decodePart(part), {
				onNone: () => rawEvent(raw),
				onSome: (known) =>
					Option.match(authors.of(known.messageID), {
						onNone: () => rawEvent(raw),
						onSome: (author) => authoredEvents(raw, known, author, firstReport),
					}),
			}),
	});
}
