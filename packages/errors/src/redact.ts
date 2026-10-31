import { Predicate, Redacted } from "effect";
import { isSensitiveKey, REDACTED, redactErrorStack, redactText, type SensitiveKey } from "#sensitive.ts";

const MAX_DEPTH = 8;
const MAX_ENTRIES = 50;
function binary(value: object): string | undefined {
	if (ArrayBuffer.isView(value)) {
		return `<${value.constructor.name} ${value.byteLength} bytes>`;
	}
	if (value instanceof ArrayBuffer) {
		return `<ArrayBuffer ${value.byteLength} bytes>`;
	}
	return undefined;
}
function entriesOf(value: object, sensitive: SensitiveKey, bounded: boolean): [string, unknown][] {
	const entries = Object.entries(value);
	if (!Predicate.isError(value)) {
		return entries;
	}
	const shape: [string, unknown][] = [
		["name", value.name],
		["message", value.message],
		["stack", bounded ? redactErrorStack(value, sensitive) : value.stack],
	];
	const extra = entries.filter(([key]) => !["name", "message", "stack", "cause"].includes(key));
	return value.cause === undefined ? [...shape, ...extra] : [...shape, ...extra, ["cause", value.cause]];
}
function collection(value: object, sensitive: SensitiveKey, depth: number, bounded: boolean, parentKey: string): unknown {
	if (Array.isArray(value)) {
		const items = value.slice(0, bounded ? MAX_ENTRIES : value.length).map((item) => walk(item, sensitive, depth + 1, bounded, parentKey));
		return bounded && value.length > MAX_ENTRIES ? [...items, `<${value.length - MAX_ENTRIES} more items>`] : items;
	}
	const entries = entriesOf(value, sensitive, bounded);
	const kept = entries.slice(0, bounded ? MAX_ENTRIES : entries.length).map(([key, nested]): [string, unknown] => {
		const stackHeader = key === "stack" && typeof nested === "string" && (sensitive("name") || sensitive("message"));
		return [key, sensitive(key) || stackHeader ? REDACTED : walk(nested, sensitive, depth + 1, bounded, key)];
	});
	return Object.fromEntries(bounded && entries.length > MAX_ENTRIES ? [...kept, ["<truncated>", `${entries.length - MAX_ENTRIES} more keys`]] : kept);
}
function walk(value: unknown, sensitive: SensitiveKey, depth: number, bounded: boolean, key = ""): unknown {
	if (Redacted.isRedacted(value)) {
		return REDACTED;
	}
	if (Predicate.isString(value)) {
		return redactText(value, sensitive, bounded ? undefined : Number.POSITIVE_INFINITY, key);
	}
	if (!Predicate.isObjectOrArray(value)) {
		return value;
	}
	const summary = binary(value);
	if (summary !== undefined) {
		return bounded ? summary : value;
	}
	if (bounded && depth >= MAX_DEPTH) {
		return "<truncated>";
	}
	return collection(value, sensitive, depth, bounded, key);
}
export function redact(value: unknown, sensitive: SensitiveKey = isSensitiveKey): unknown {
	return walk(value, sensitive, 0, true);
}
export function redactWire(value: unknown, sensitive: SensitiveKey = isSensitiveKey): unknown {
	return walk(value, sensitive, 0, false);
}
export function redactRecord(values: Readonly<Record<string, unknown>>, sensitive: SensitiveKey = isSensitiveKey): Record<string, unknown> {
	return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, sensitive(key) ? REDACTED : walk(value, sensitive, 0, true, key)]));
}
