import { Effect, Layer } from "effect";
import type { OtlpResource } from "effect/observability";
import { OtlpSerialization } from "effect/observability";
import { redactOtlpUrl } from "#redactOtlpUrl.ts";
import { isSensitiveKey, REDACTED, redactText } from "#rpc-server/sensitive.ts";

function sensitive(key: string) {
	return isSensitiveKey(key) || ["db.user", "db.user.name", "db.connection_string"].includes(key.toLowerCase());
}
export function redactOtlpText(value: string, key = "") {
	return redactText(redactOtlpUrl(value, key), sensitive);
}
function attributeValue(value: OtlpResource.AnyValue, key: string): OtlpResource.AnyValue {
	return {
		...value,
		...(typeof value.stringValue === "string" ? { stringValue: redactOtlpText(value.stringValue, key) } : {}),
		...(value.arrayValue ? { arrayValue: { values: value.arrayValue.values.map((item) => attributeValue(item, key)) } } : {}),
		...(value.kvlistValue ? { kvlistValue: { values: attributes(value.kvlistValue.values) } } : {}),
	};
}
function attributes(values: OtlpResource.KeyValue[]): OtlpResource.KeyValue[] {
	return values.map(({ key, value }) => ({
		key,
		value: sensitive(key) ? { stringValue: REDACTED } : attributeValue(value, key),
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

export const safeOtlpSerialization = Layer.effect(
	OtlpSerialization.OtlpSerialization,
	Effect.map(OtlpSerialization.OtlpSerialization, (serialization) => ({
		...serialization,
		traces: (data) =>
			serialization.traces({
				...data,
				resourceSpans: data.resourceSpans.map((resource) => ({
					...resource,
					resource: { ...resource.resource, attributes: attributes(resource.resource.attributes) },
					scopeSpans: resource.scopeSpans.map((scope) => ({
						...scope,
						spans: scope.spans.map((span) => ({
							...span,
							attributes: attributes(span.attributes),
							events: span.events.map((event) => ({ ...event, attributes: attributes(event.attributes), name: redactOtlpText(event.name) })),
							links: span.links.map((link) => ({ ...link, attributes: attributes(link.attributes) })),
							name: redactOtlpText(spanName(span)),
							status: { ...span.status, ...(span.status.message === undefined ? {} : { message: redactOtlpText(span.status.message) }) },
						})),
					})),
				})),
			}),
	})),
);
