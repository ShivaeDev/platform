const OWN_ERROR_KEYS = new Set(["_tag", "cause", "message", "name", "stack"]);

export function describeValue(value: unknown): string {
	if (typeof value === "string") {
		return value;
	}
	if (value instanceof Error) {
		return describeError(value);
	}
	return typeof value === "object" && value !== null ? toJson(value) : String(value);
}

function describeError(error: Error): string {
	const tag = "_tag" in error && typeof error._tag === "string" ? error._tag : error.name;
	const fields = Object.fromEntries(Object.entries(error).filter(([key]) => !OWN_ERROR_KEYS.has(key)));
	const label = tag === "Error" ? "" : tag;
	const detail = Object.keys(fields).length === 0 ? "" : toJson(fields);
	if (error.message === "") {
		return [label, detail].filter((part) => part !== "").join(" ") || "Error";
	}
	return [label === "" ? error.message : `${label}: ${error.message}`, detail].filter((part) => part !== "").join(" ");
}

export function toJson(value: unknown, indent?: number): string {
	const seen = new WeakSet<object>();
	const json = JSON.stringify(
		value,
		(_key, item: unknown) => {
			if (typeof item === "bigint") {
				return `${item}n`;
			}
			if (typeof item === "symbol") {
				return item.toString();
			}
			if (item instanceof Error) {
				return describeError(item);
			}
			if (typeof item !== "object" || item === null) {
				return item;
			}
			if (seen.has(item)) {
				return "[shown above]";
			}
			seen.add(item);
			if (item instanceof Map) {
				return Object.fromEntries([...item].map(([key, entry]: readonly [unknown, unknown]) => [describeValue(key), entry]));
			}
			return item instanceof Set ? [...item] : item;
		},
		indent,
	);
	return json ?? String(value);
}
