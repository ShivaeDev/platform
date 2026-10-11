import { Equal } from "effect";
import type { Path } from "./shape.ts";

type Key = (element: unknown) => PropertyKey;
export type KeySelectors = ReadonlyMap<string, Key>;

export interface PathMessage {
	readonly message: string;
	readonly path: Path;
}

export function keySelector(selector: unknown): Key;
export function keySelector(selector: unknown): unknown {
	return selector;
}

export function asPath(path: string | Path): Path {
	return typeof path === "string" ? [path] : path;
}

function lookup(value: unknown, path: readonly PropertyKey[]): { readonly value: unknown } | undefined {
	let current = value;
	for (const [index, segment] of path.entries()) {
		if (typeof current !== "object" || current === null) {
			return undefined;
		}
		if (!Object.hasOwn(current, segment)) {
			return index === path.length - 1 && !Array.isArray(current) ? { value: undefined } : undefined;
		}
		current = Reflect.get(current, segment);
	}
	return { value: current };
}

function uniqueIndex(values: readonly unknown[], key: PropertyKey, select: Key): number | undefined {
	const matches = values.flatMap((value, index) => (select(value) === key ? [index] : []));
	return matches.length === 1 ? matches[0] : undefined;
}

export function retainedPath(path: Path, previous: unknown, current: unknown, keys: KeySelectors): Path | undefined {
	const select = keys.get(path[0]);
	let next = path;
	if (select !== undefined && typeof path[1] === "number") {
		const before = lookup(previous, [path[0]])?.value;
		const after = lookup(current, [path[0]])?.value;
		if (!(Array.isArray(before) && Array.isArray(after) && Object.hasOwn(before, path[1]))) {
			return undefined;
		}
		const key = select(before[path[1]]);
		const index = uniqueIndex(after, key, select);
		if (index === undefined || uniqueIndex(before, key, select) !== path[1]) {
			return undefined;
		}
		next = [path[0], index, ...path.slice(2)];
	}
	const before = lookup(previous, path);
	const after = lookup(current, next);
	return before !== undefined && after !== undefined && Equal.equals(before.value, after.value) ? next : undefined;
}

export function pathMessageAt(messages: readonly PathMessage[], path: readonly PropertyKey[]): string | undefined {
	return messages.find((entry) => path.every((segment, index) => segment === entry.path[index]))?.message;
}
