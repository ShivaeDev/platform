import { Effect, Exit, Layer, Option, Tracer } from "effect";
import { redactRecord } from "@shivaedev/errors/redact.ts";
import { redactDiagnosticCause } from "@shivaedev/errors/redactCause.ts";
import type { SensitiveKey } from "@shivaedev/errors/sensitive.ts";
import { type HostRedactionPolicy, redactionForRpc } from "#RedactionPolicy.ts";

function redactLinks(values: readonly Tracer.SpanLink[], sensitive: SensitiveKey) {
	return values.map((link) => ({ ...link, attributes: redactRecord(link.attributes, sensitive) }));
}
function redactSpan(span: Tracer.Span, policy: HostRedactionPolicy) {
	const end = span.end.bind(span);
	const attribute = span.attribute.bind(span);
	function safeAttribute(key: string, value: unknown) {
		return attribute(key, redactRecord({ [key]: value }, sensitive)[key]);
	}
	const event = span.event.bind(span);
	const addLinks = span.addLinks.bind(span);
	function sensitive(key: string) {
		return redactionForRpc(policy, span.attributes.get("rpc.method"))(key);
	}
	return Object.assign(span, {
		addLinks: (values: readonly Tracer.SpanLink[]) => addLinks(redactLinks(values, sensitive)),
		attribute: safeAttribute,
		end: (time: bigint, exit: Exit.Exit<unknown, unknown>) => {
			for (const [key, value] of span.attributes) {
				safeAttribute(key, value);
			}
			end(time, Exit.isFailure(exit) ? Exit.failCause(redactDiagnosticCause(exit.cause, sensitive)) : exit);
		},
		event: (name: string, time: bigint, attributes?: Record<string, unknown>) => event(name, time, attributes && redactRecord(attributes, sensitive)),
	});
}
export function redactingTracer(sensitive: HostRedactionPolicy) {
	return Layer.effect(
		Tracer.Tracer,
		Effect.map(Tracer.Tracer, (tracer) =>
			Tracer.make({
				...tracer,
				span: (options) => {
					const method = Option.match(options.parent, {
						onNone: () => undefined,
						onSome: (parent) => (parent._tag === "Span" ? parent.attributes.get("rpc.method") : undefined),
					});
					const span = tracer.span({ ...options, links: redactLinks(options.links, redactionForRpc(sensitive, method)) });
					if (typeof method === "string") {
						span.attribute("rpc.method", method);
					}
					return redactSpan(span, sensitive);
				},
			}),
		),
	);
}
