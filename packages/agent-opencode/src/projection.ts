import type { RunEvent as AgentEvent } from "@shivaedev/agent/events.ts";
import { rawEvent, rawOf } from "#mapping.ts";
import { openMessageAuthors } from "#messageAuthors.ts";
import { openTurnBoundary } from "#openTurnBoundary.ts";
import { partEvents } from "#partEvents.ts";
import type { SessionFrame } from "#sessionFrames.ts";

function openFirstReport(): (key: string) => boolean {
	const reported = new Set<string>();
	return (key) => {
		if (reported.has(key)) {
			return false;
		}
		reported.add(key);
		return true;
	};
}
export interface SessionProjection {
	readonly events: (frame: SessionFrame) => AgentEvent[];
}
export function openSessionProjection(sessionModel: string | undefined): SessionProjection {
	const authors = openMessageAuthors(sessionModel);
	const boundary = openTurnBoundary();
	const firstReport = openFirstReport();
	function project(type: string, properties: unknown): AgentEvent[] {
		const raw = rawOf(type, properties);
		switch (type) {
			case "message.updated":
				authors.record(properties);
				return [];
			case "message.part.updated":
				return partEvents(raw, properties, authors, firstReport);
			case "message.part.delta":
				return [];
			case "session.error":
				return boundary.errored(raw, properties);
			case "session.idle":
				return boundary.idled(raw);
			case "session.status":
				return boundary.status(raw, properties);
			default:
				return rawEvent(raw);
		}
	}
	return { events: (frame) => project(frame.type, frame.properties) };
}
