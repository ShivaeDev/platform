import { Cause, Exit } from "effect";
import { PRIVATE_FIELD, WEBHOOK_SECRET } from "#test/fixture.ts";
import type { InboxState } from "#test/host.ts";

function spans(state: InboxState) {
	return state.telemetry.spans.map(({ name, attributes, events, status }) => ({
		attributes: [...attributes],
		events: events.map(([eventName, , fields]) => ({ fields, name: eventName })),
		exit: status._tag === "Ended" ? status.exit : undefined,
		name,
	}));
}

export function secretsSeenIn(state: InboxState) {
	const places = { "logs": JSON.stringify(state.logs), "spans": JSON.stringify(spans(state)), "the answer": JSON.stringify(state.answers) };
	const secrets: ReadonlyArray<readonly [string, string]> = [
		["the signing key", WEBHOOK_SECRET],
		["a private body field", PRIVATE_FIELD],
		...state.sent.flatMap(({ body, signature }) => [
			["the raw body", body] as const,
			...(signature === null ? [] : [["the signature", signature] as const]),
		]),
	];
	const seen: Record<string, string[]> = {};
	for (const [secret, value] of secrets) {
		const where = Object.entries(places).flatMap(([place, captured]) => (captured.includes(value) ? [place] : []));
		if (where.length > 0) {
			seen[secret] = where;
		}
	}
	return seen;
}

export function spanNames(state: InboxState) {
	return state.telemetry.spans.map(({ name }) => name);
}

export function requestOutcomes(state: InboxState) {
	return state.telemetry.spans
		.filter(({ name }) => name === "POST")
		.map(({ attributes, status }) => {
			const response = attributes.get("http.response.status_code");
			if (status._tag !== "Ended") {
				return { outcome: "running", response };
			}
			return Exit.isFailure(status.exit)
				? { failure: Cause.pretty(status.exit.cause), outcome: "failed", response }
				: { outcome: "succeeded", response };
		});
}
