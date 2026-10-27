import { Effect, Layer } from "effect";
import type { OtlpResource, OtlpTracer } from "effect/observability";
import { OtlpSerialization } from "effect/observability";
import { isSensitiveKey, REDACTED, redactText, type SensitiveKey } from "@shivaedev/errors/sensitive.ts";
import { RedactionPolicy } from "#RedactionPolicy.ts";
import { redactOtlpUrl } from "#redactOtlpUrl.ts";

function otlpSensitive(sensitive: SensitiveKey): SensitiveKey {
	return (key) => sensitive(key) || ["db.user", "db.user.name", "db.connection_string"].includes(key.toLowerCase());
}
export function redactOtlpText(value: string, key = "", sensitive: SensitiveKey = isSensitiveKey) {
	return redactText(redactOtlpUrl(value, key), otlpSensitive(sensitive));
}
function attributeValue(value: OtlpResource.AnyValue, key: string, sensitive: SensitiveKey): OtlpResource.AnyValue {
	return {
		...value,
		...(typeof value.stringValue === "string" ? { stringValue: redactOtlpText(value.stringValue, key, sensitive) } : {}),
		...(value.arrayValue ? { arrayValue: { values: value.arrayValue.values.map((item) => attributeValue(item, key, sensitive)) } } : {}),
		...(value.kvlistValue ? { kvlistValue: { values: attributes(value.kvlistValue.values, sensitive) } } : {}),
	};
}
function attributes(values: OtlpResource.KeyValue[], sensitive: SensitiveKey): OtlpResource.KeyValue[] {
	return values.map(({ key, value }) => ({
		key,
		value: sensitive(key) ? { stringValue: REDACTED } : attributeValue(value, key, sensitive),
	}));
}

function spanName(span: { readonly name: string; readonly kind: number; readonly attributes: OtlpResource.KeyValue[] }) {
	if (span.kind === 2) {
		const method = span.attributes.find(({ key }) => key === "http.request.method")?.value.stringValue;
		const route = span.attributes.find(({ key }) => key === "http.route")?.value.stringValue;
		if (typeof method === "string") {
			return typeof route === "string" ? `${method} ${route}` : method;
		}
	}
	return span.name;
}

function redactTraces(data: OtlpTracer.TraceData, sensitive: SensitiveKey): OtlpTracer.TraceData {
	function text(value: string) {
		return redactOtlpText(value, "", sensitive);
	}
	return {
		...data,
		resourceSpans: data.resourceSpans.map((resource) => ({
			...resource,
			resource: { ...resource.resource, attributes: attributes(resource.resource.attributes, sensitive) },
			scopeSpans: resource.scopeSpans.map((scope) => ({
				...scope,
				spans: scope.spans.map((span) => ({
					...span,
					attributes: attributes(span.attributes, sensitive),
					events: span.events.map((event) => ({ ...event, attributes: attributes(event.attributes, sensitive), name: text(event.name) })),
					links: span.links.map((link) => ({ ...link, attributes: attributes(link.attributes, sensitive) })),
					name: text(spanName(span)),
					status: { ...span.status, ...(span.status.message === undefined ? {} : { message: text(span.status.message) }) },
				})),
			})),
		})),
	};
}
export const safeOtlpSerialization = Layer.effect(
	OtlpSerialization.OtlpSerialization,
	Effect.gen(function* () {
		const serialization = yield* OtlpSerialization.OtlpSerialization;
		const sensitive = otlpSensitive(yield* RedactionPolicy);
		return OtlpSerialization.OtlpSerialization.of({
			...serialization,
			traces: (data) => serialization.traces(redactTraces(data, sensitive)),
		});
	}),
);
