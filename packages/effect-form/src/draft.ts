import { Equal } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRef from "effect/unstable/reactivity/AtomRef";
import type { Persistence } from "./persistence.ts";

type Entries = Readonly<Record<string, unknown>>;

interface Draft<Values> {
	readonly baseline: Values;
	readonly current: Values;
	readonly settled: Entries;
}

const none: Entries = {};

function untouched({ baseline, current, settled }: Draft<Entries>, name: string): boolean {
	return Equal.equals(current[name], baseline[name]) || (Object.hasOwn(settled, name) && Equal.equals(current[name], settled[name]));
}

function changed(held: Draft<Entries>): boolean {
	return Object.keys({ ...held.baseline, ...held.current }).some((name) => !untouched(held, name));
}

function merged<Values>(held: Draft<Values>, incoming: Values): Values;
function merged(held: Draft<Entries>, incoming: Entries): unknown {
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

export const draft = <Values extends Entries>(initial: Values, persistence?: Persistence<Values>) => {
	const restored = persistence?.read();
	const loaded = {
		baseline: restored?.baseline ?? initial,
		current: restored?.values ?? initial,
		settled: restored ? Object.fromEntries(Object.entries(restored.values).filter(([name]) => !restored.edited.includes(name))) : none,
	};
	const state = AtomRef.make<Draft<Values>>({
		baseline: initial,
		current: restored ? merged(loaded, initial) : initial,
		settled: none,
	});
	if (persistence) {
		state.subscribe((value) => {
			if (changed(value)) {
				const edited = Object.keys({ ...value.baseline, ...value.current }).filter((name) => !untouched(value, name));
				persistence.write({ ...value.baseline, ...value.settled }, value.current, edited);
			} else {
				persistence.clear();
			}
		});
	}
	return {
		dirty: Atom.readable((get) => {
			get.addFinalizer(state.subscribe((value) => get.setSelf(changed(value))));
			return changed(state.value);
		}),
		receive: (incoming: Values): void => {
			state.update((held) => ({
				baseline: incoming,
				current: changed(held) ? merged(held, incoming) : incoming,
				settled: none,
			}));
		},
		revert: (): void => {
			state.update((held) => ({
				...held,
				current: held.baseline,
				settled: none,
			}));
		},
		submission: () => {
			const { baseline, current: submitted } = state.value;
			return {
				accept: (): void => {
					state.update((held) =>
						held.baseline === baseline ? { ...held, baseline: submitted, settled: none } : { ...held, settled: matching(held.current, submitted) },
					);
				},
				values: submitted,
			};
		},
		values: state.prop("current"),
	};
};
