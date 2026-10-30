import { Cause, Exit, Option, type Tracer } from "effect";
import { failureOf } from "#test/failureOf.ts";

export interface SpanReadout {
	readonly attributes: Readonly<Record<string, unknown>>;
	readonly events: readonly string[];
	readonly links: readonly string[];
	readonly name: string;
	readonly outcome: string;
	readonly parent: string;
	readonly trace: string;
}

function outcomeOf(span: Tracer.NativeSpan): string {
	if (span.status._tag !== "Ended") {
		return "open";
	}
	if (Exit.isSuccess(span.status.exit)) {
		return "succeeded";
	}
	return `failed with ${failureOf(Cause.squash(span.status.exit.cause))}`;
}

export function spanTree(spans: readonly Tracer.NativeSpan[]): readonly SpanReadout[] {
	const traces: string[] = [];
	function traceName(traceId: string) {
		if (!traces.includes(traceId)) {
			traces.push(traceId);
		}
		return `trace ${traces.indexOf(traceId) + 1}`;
	}
	function spanName(spanId: string, traceId: string) {
		return spans.find((span) => span.spanId === spanId)?.name ?? `external span ${spanId} in trace ${traceId}`;
	}
	return spans.map((span) => ({
		attributes: Object.fromEntries(span.attributes),
		events: span.events.map(([name, , attributes]) => (attributes === undefined ? name : `${name} ${JSON.stringify(attributes)}`)),
		links: span.links.map((link) => spanName(link.span.spanId, link.span.traceId)),
		name: span.name,
		outcome: outcomeOf(span),
		parent: Option.match(span.parent, { onNone: () => "no parent", onSome: (parent) => spanName(parent.spanId, parent.traceId) }),
		trace: traceName(span.traceId),
	}));
}
