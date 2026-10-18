import { Schema } from "effect";
import { otlpProtobuf } from "#internal/otlpProtobuf.ts";
import { Attribute } from "#internal/otlpValue.ts";

const Attributes = Schema.optionalKey(Schema.Array(Attribute));
const Span = Schema.Struct({
	attributes: Attributes,
	endTimeUnixNano: Schema.optionalKey(Schema.String),
	events: Schema.optionalKey(
		Schema.Array(Schema.Struct({ attributes: Attributes, name: Schema.String, timeUnixNano: Schema.optionalKey(Schema.String) })),
	),
	kind: Schema.optionalKey(Schema.Number),
	links: Schema.optionalKey(Schema.Array(Schema.Struct({ attributes: Attributes, spanId: Schema.String, traceId: Schema.String }))),
	name: Schema.String,
	parentSpanId: Schema.optionalKey(Schema.String),
	spanId: Schema.String,
	startTimeUnixNano: Schema.optionalKey(Schema.String),
	status: Schema.optionalKey(Schema.Struct({ code: Schema.optionalKey(Schema.Number), message: Schema.optionalKey(Schema.String) })),
	traceId: Schema.String,
});
const Payload = Schema.Struct({
	resourceSpans: Schema.optionalKey(
		Schema.Array(
			Schema.Struct({
				resource: Schema.optionalKey(Schema.Struct({ attributes: Attributes })),
				scopeSpans: Schema.optionalKey(Schema.Array(Schema.Struct({ spans: Schema.optionalKey(Schema.Array(Span)) }))),
			}),
		),
	),
});

function normalizeIntegers(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(normalizeIntegers);
	}
	if (typeof value !== "object" || value === null) {
		return value;
	}
	return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, key === "intValue" ? String(item) : normalizeIntegers(item)]));
}

export function otlpReadout(bytes: Buffer, contentType: string) {
	const data = Schema.decodeUnknownSync(Payload)(
		normalizeIntegers(contentType === "application/x-protobuf" ? otlpProtobuf(bytes) : JSON.parse(bytes.toString())),
	);
	return (data.resourceSpans ?? []).flatMap((resource) =>
		(resource.scopeSpans ?? []).flatMap((scope) =>
			(scope.spans ?? []).map((span) => ({
				...span,
				attributes: span.attributes ?? [],
				events: (span.events ?? []).map((event) => ({ ...event, attributes: event.attributes ?? [] })),
				kind: span.kind ?? 0,
				links: (span.links ?? []).map((link) => ({ ...link, attributes: link.attributes ?? [] })),
				resourceAttributes: resource.resource?.attributes ?? [],
				status: { ...span.status, code: span.status?.code ?? 0 },
			})),
		),
	);
}
