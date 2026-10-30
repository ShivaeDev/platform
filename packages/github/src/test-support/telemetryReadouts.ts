import type { telemetry } from "./telemetry.ts";

type Recording = ReturnType<typeof telemetry>;
export type Place = "failures" | "logs" | "spans" | "span events";

export function rateLimitLogs(recording: Recording) {
	return recording.logs.flatMap(({ message }) => (Array.isArray(message) && message[0] === "GitHub rate limited" ? [message[1]] : []));
}

export function rateLimitEvents(recording: Recording) {
	return recording.spans.flatMap((span) => span.events.filter(([name]) => name === "GitHub.rateLimited").map(([, , fields]) => fields));
}

function captured(recording: Recording, failures: readonly unknown[]): Record<Place, unknown> {
	return {
		failures,
		logs: recording.logs,
		"span events": recording.spans.flatMap(({ events }) => events.map(([name, , fields]) => ({ fields, name }))),
		spans: recording.spans.map(({ attributes, events, status }) => ({
			attributes: [...attributes],
			events: events.map(([name, , fields]) => ({ fields, name })),
			exit: status._tag === "Ended" ? status.exit : undefined,
		})),
	};
}

export function seenIn(secret: string, recording: Recording, failures: readonly unknown[], places: readonly Place[]) {
	const escaped = JSON.stringify(secret).slice(1, -1);
	const all = captured(recording, failures);
	return places.filter((place) => {
		const text = JSON.stringify(all[place]);
		return text.includes(secret) || text.includes(escaped);
	});
}
