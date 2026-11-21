import type { OtlpSpan } from "@shivaedev/test-story/server/otlpReceiver.ts";

function attributeValue(value: unknown): unknown {
	const entry = typeof value === "object" && value !== null ? Object.values(value)[0] : value;
	if (typeof entry === "object" && entry !== null && "values" in entry && Array.isArray(entry.values)) {
		return entry.values.map(attributeValue);
	}
	return typeof entry === "string" && entry.startsWith("{") ? JSON.parse(entry) : entry;
}

export function spanAttribute(span: OtlpSpan, key: string): unknown {
	return attributeValue(span.attributes.find((attribute) => attribute.key === key)?.value);
}
