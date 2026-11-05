import { Equal } from "effect";

const omitted = Symbol("omitted");

export type Entries = Readonly<Record<string, unknown>>;

export interface Draft<TValues> {
	readonly baseline: TValues;
	readonly current: TValues;
	readonly settled: Entries;
}

function sameField(left: Entries, right: Entries, name: string): boolean {
	return Object.hasOwn(left, name) === Object.hasOwn(right, name) && Equal.equals(left[name], right[name]);
}

export function settledBaseline<TValues>(held: Draft<TValues>): TValues;
export function settledBaseline({ baseline, settled }: Draft<Entries>): Entries {
	const result = { ...baseline, ...settled };
	for (const name of Object.keys(settled)) {
		if (settled[name] === omitted) {
			delete result[name];
		}
	}
	return result;
}

export function untouched({ baseline, current, settled }: Draft<Entries>, name: string): boolean {
	return (
		sameField(current, baseline, name)
		|| (Object.hasOwn(settled, name)
			&& (settled[name] === omitted ? !Object.hasOwn(current, name) : Object.hasOwn(current, name) && Equal.equals(current[name], settled[name])))
	);
}

export function changed(held: Draft<Entries>): boolean {
	return Object.keys({ ...held.baseline, ...held.current }).some((name) => !untouched(held, name));
}

export function merged<TValues>(held: Draft<TValues>, incoming: TValues): TValues;
export function merged(held: Draft<Entries>, incoming: Entries): unknown {
	const result: Record<string, unknown> = {};
	for (const name of Object.keys({ ...held.current, ...incoming })) {
		const source = untouched(held, name) ? incoming : held.current;
		if (Object.hasOwn(source, name)) {
			result[name] = source[name];
		}
	}
	return result;
}

function matching(current: Entries, submitted: Entries, baseline: Entries): Entries {
	return Object.fromEntries(
		Object.keys({ ...baseline, ...current, ...submitted })
			.filter((name) => sameField(current, submitted, name))
			.map((name) => [name, Object.hasOwn(submitted, name) ? submitted[name] : omitted]),
	);
}

export function mergeObserved<TValues>(current: TValues, incoming: TValues, local: ReadonlySet<string>): TValues;
export function mergeObserved(current: Entries, incoming: Entries, local: ReadonlySet<string>): unknown {
	const result: Record<string, unknown> = {};
	for (const name of Object.keys({ ...current, ...incoming })) {
		const source = local.has(name) ? current : incoming;
		if (Object.hasOwn(source, name)) {
			result[name] = source[name];
		}
	}
	return result;
}

export function changedFields(previous: Entries, current: Entries): readonly string[] {
	return Object.keys({ ...previous, ...current }).filter((name) => !sameField(previous, current, name));
}

export function accepted<TValues extends Entries>(held: Draft<TValues>, baseline: TValues, submitted: TValues, incoming?: TValues): Draft<TValues> {
	if (held.baseline !== baseline) {
		return { ...held, settled: matching(held.current, submitted, held.baseline) };
	}
	return {
		...held,
		baseline: incoming ?? submitted,
		current: incoming === undefined ? held.current : merged({ ...held, baseline: submitted, settled: {} }, incoming),
		settled: {},
	};
}
