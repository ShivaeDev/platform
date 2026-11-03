import { Equal } from "effect";

export type Entries = Readonly<Record<string, unknown>>;

export interface Draft<TValues> {
	readonly baseline: TValues;
	readonly current: TValues;
	readonly settled: Entries;
}

export function untouched({ baseline, current, settled }: Draft<Entries>, name: string): boolean {
	return Equal.equals(current[name], baseline[name]) || (Object.hasOwn(settled, name) && Equal.equals(current[name], settled[name]));
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

function matching(current: Entries, submitted: Entries): Entries {
	return Object.fromEntries(
		Object.keys({ ...current, ...submitted })
			.filter((name) => Equal.equals(current[name], submitted[name]))
			.map((name) => [name, submitted[name]]),
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
	return Object.keys({ ...previous, ...current }).filter((name) => !Equal.equals(previous[name], current[name]));
}

export function accepted<TValues extends Entries>(held: Draft<TValues>, baseline: TValues, submitted: TValues, incoming?: TValues): Draft<TValues> {
	if (held.baseline !== baseline) {
		return { ...held, settled: matching(held.current, submitted) };
	}
	return {
		...held,
		baseline: incoming ?? submitted,
		current: incoming === undefined ? held.current : merged({ ...held, baseline: submitted, settled: {} }, incoming),
		settled: {},
	};
}
