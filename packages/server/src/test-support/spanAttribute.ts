import type { OtlpSpan } from "@shivaedev/test-story/server/otlpReceiver.ts";

export function spanAttribute(span: OtlpSpan, key: string): unknown {
	const value = span.attributes.find((attribute) => attribute.key === key)?.value;
	const entry = typeof value === "object" && value !== null ? Object.values(value)[0] : value;
	return typeof entry === "string" && entry.startsWith("{") ? JSON.parse(entry) : entry;
}
