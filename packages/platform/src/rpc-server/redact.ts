import { Predicate, Redacted } from "effect";
import { isSensitiveKey, REDACTED, redactText, type SensitiveKey } from "./sensitive.ts";

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

function entriesOf(value: object): [string, unknown][] {
	const entries = Object.entries(value);
	if (!Predicate.isError(value)) {
		return entries;
	}
	const shape: [string, unknown][] = [
		["name", value.name],
		["message", value.message],
		["stack", value.stack],
	];
	return value.cause === undefined ? [...shape, ...entries] : [...shape, ...entries, ["cause", value.cause]];
}

function walk(value: unknown, sensitive: SensitiveKey, depth: number): unknown {
	if (Redacted.isRedacted(value)) {
		return REDACTED;
	}
	if (Predicate.isString(value)) {
		return redactText(value, sensitive);
	}
	if (!Predicate.isObjectOrArray(value)) {
		return value;
	}
	const summary = binary(value);
	if (summary !== undefined) {
		return summary;
	}
	if (depth >= MAX_DEPTH) {
		return "<truncated>";
	}
	if (Array.isArray(value)) {
		const items = value.slice(0, MAX_ENTRIES).map((item) => walk(item, sensitive, depth + 1));
		return value.length > MAX_ENTRIES ? [...items, `<${value.length - MAX_ENTRIES} more items>`] : items;
	}
	const entries = entriesOf(value);
	const kept = entries
		.slice(0, MAX_ENTRIES)
		.map(([key, nested]): [string, unknown] => [key, sensitive(key) ? REDACTED : walk(nested, sensitive, depth + 1)]);
	return Object.fromEntries(entries.length > MAX_ENTRIES ? [...kept, ["<truncated>", `${entries.length - MAX_ENTRIES} more keys`]] : kept);
}

export const redact = (value: unknown, sensitive: SensitiveKey = isSensitiveKey): unknown => walk(value, sensitive, 0);
