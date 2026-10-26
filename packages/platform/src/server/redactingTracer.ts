import { Effect, Exit, Layer, Tracer } from "effect";
import { redact } from "@shivaedev/errors/redact.ts";
import { redactDiagnosticCause } from "@shivaedev/errors/redactCause.ts";
import { REDACTED, type SensitiveKey } from "@shivaedev/errors/sensitive.ts";
import { redactRecord } from "#server/redactingDiagnostics.ts";

function redactLinks(values: readonly Tracer.SpanLink[], sensitive: SensitiveKey) {
	return values.map((link) => ({ ...link, attributes: redactRecord(link.attributes, sensitive) }));
}
function redactSpan(span: Tracer.Span, sensitive: SensitiveKey) {
	const end = span.end.bind(span);
	const attribute = span.attribute.bind(span);
	const event = span.event.bind(span);
	const addLinks = span.addLinks.bind(span);
	return Object.assign(span, {
		addLinks: (values: readonly Tracer.SpanLink[]) => addLinks(redactLinks(values, sensitive)),
		attribute: (key: string, value: unknown) => attribute(key, sensitive(key) ? REDACTED : redact(value, sensitive)),
		end: (time: bigint, exit: Exit.Exit<unknown, unknown>) => {
			for (const [key, value] of span.attributes) {
				attribute(key, sensitive(key) ? REDACTED : redact(value, sensitive));
			}
			end(time, Exit.isFailure(exit) ? Exit.failCause(redactDiagnosticCause(exit.cause, sensitive)) : exit);
		},
		event: (name: string, time: bigint, attributes?: Record<string, unknown>) => event(name, time, attributes && redactRecord(attributes, sensitive)),
	});
}
export function redactingTracer(sensitive: SensitiveKey) {
	return Layer.effect(
		Tracer.Tracer,
		Effect.map(Tracer.Tracer, (tracer) =>
			Tracer.make({
				...tracer,
				span: (options) => redactSpan(tracer.span({ ...options, links: redactLinks(options.links, sensitive) }), sensitive),
			}),
		),
	);
}
