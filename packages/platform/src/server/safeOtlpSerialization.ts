import { Layer } from "effect";
import { HttpBody } from "effect/http";
import type { OtlpResource } from "effect/observability";
import { OtlpSerialization } from "effect/observability";
import { isSensitiveKey, REDACTED, redactText } from "#rpc-server/sensitive.ts";

function sensitive(key: string) {
	return isSensitiveKey(key) || ["db.user", "db.user.name", "db.connection_string"].includes(key.toLowerCase());
}
function text(value: string) {
	return redactText(value, sensitive).replaceAll(/(?<scheme>\b[a-z][a-z0-9+.-]*:\/\/)[^/@\s]+@/giu, `$<scheme>${REDACTED}@`);
}
function attributeValue(value: OtlpResource.AnyValue): OtlpResource.AnyValue {
	return {
		...value,
		...(typeof value.stringValue === "string" ? { stringValue: text(value.stringValue) } : {}),
		...(value.arrayValue ? { arrayValue: { values: value.arrayValue.values.map(attributeValue) } } : {}),
		...(value.kvlistValue ? { kvlistValue: { values: attributes(value.kvlistValue.values) } } : {}),
	};
}
function attributes(values: OtlpResource.KeyValue[]): OtlpResource.KeyValue[] {
	return values.map(({ key, value }) => ({
		key,
		value: sensitive(key) ? { stringValue: REDACTED } : attributeValue(value),
	}));
}

export const safeOtlpSerialization = Layer.succeed(OtlpSerialization.OtlpSerialization, {
	logs: HttpBody.jsonUnsafe,
	metrics: HttpBody.jsonUnsafe,
	traces: (data) =>
		HttpBody.jsonUnsafe({
			...data,
			resourceSpans: data.resourceSpans.map((resource) => ({
				...resource,
				resource: { ...resource.resource, attributes: attributes(resource.resource.attributes) },
				scopeSpans: resource.scopeSpans.map((scope) => ({
					...scope,
					spans: scope.spans.map((span) => ({
						...span,
						attributes: attributes(span.attributes),
						events: span.events.map((event) => ({ ...event, attributes: attributes(event.attributes), name: text(event.name) })),
						links: span.links.map((link) => ({ ...link, attributes: attributes(link.attributes) })),
						name: text(span.name),
						status: { ...span.status, ...(span.status.message === undefined ? {} : { message: text(span.status.message) }) },
					})),
				})),
			})),
		}),
});
