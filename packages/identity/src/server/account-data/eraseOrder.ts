import { Result } from "effect";

export interface Reference {
	readonly source: string;
	readonly target: string;
}

interface Remaining {
	readonly left: readonly string[];
	readonly references: readonly Reference[];
}

// A table goes once nothing left references it, so the rows referencing a table are deleted before the table's rows.
function peel({ left, references }: Remaining, order: readonly string[]): Remaining & { readonly order: readonly string[] } {
	const next = left.find((table) => !references.some(({ target }) => target === table));
	if (next === undefined) {
		return { left, order, references };
	}
	const remaining = { left: left.filter((table) => table !== next), references: references.filter(({ source }) => source !== next) };
	return peel(remaining, [...order, next]);
}

// Dropping what references nothing left keeps the tables on a cycle and those between its tables.
function cycle({ left, references }: Remaining): readonly string[] {
	const sink = left.find((table) => !references.some(({ source }) => source === table));
	if (sink === undefined) {
		return left;
	}
	return cycle({ left: left.filter((table) => table !== sink), references: references.filter(({ target }) => target !== sink) });
}

export function eraseOrder(tables: readonly string[], references: readonly Reference[]): Result.Result<readonly string[], readonly string[]> {
	const between = references.filter(({ source, target }) => source !== target && tables.includes(source) && tables.includes(target));
	const peeled = peel({ left: tables, references: between }, []);
	return peeled.left.length === 0 ? Result.succeed(peeled.order) : Result.fail(cycle(peeled));
}
