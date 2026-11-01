import { Cause, Effect } from "effect";
import type { HostState } from "./state.ts";
import { attributesOf } from "./traceVerbs.ts";

export function browserErrorReadouts(state: HostState) {
	return {
		browserReportLogs: () =>
			Effect.sync(() =>
				state.logs
					.filter((entry) => entry.annotations["browser.kind"] !== undefined)
					.map((entry) => ({
						annotations: entry.annotations,
						level: entry.level,
						text: `${String(entry.message)}\n${Cause.pretty(entry.cause ?? Cause.empty)}`,
					})),
			),
		browserReportSpans: () =>
			Effect.sync(() =>
				(state.receiver?.spans ?? [])
					.filter((span) => span.name === "effect.error")
					.map((span) => ({
						attributes: attributesOf(span.attributes),
						exceptions: span.events.filter((event) => event.name === "exception").map((event) => attributesOf(event.attributes)),
					})),
			),
	};
}
