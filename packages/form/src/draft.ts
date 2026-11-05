import * as Atom from "effect/reactivity/Atom";
import * as AtomRef from "effect/reactivity/AtomRef";
import { accepted, changed, changedFields, type Draft, type Entries, merged, mergeObserved, settledBaseline, untouched } from "./draftValues.ts";
import type { Persistence, StoredValues } from "./persistence.ts";

export function draft<TValues extends Entries>(initial: TValues, persistence?: Persistence<TValues>) {
	const none: Entries = {};
	const state = AtomRef.make<Draft<TValues>>({ baseline: initial, current: initial, settled: none });
	const local = new Set<string>();
	let previous = initial;
	let receiving = false;
	let refreshing = false;
	function withoutWriting(run: () => void) {
		receiving = true;
		run();
		receiving = false;
	}
	function restore(restored: StoredValues<TValues> | undefined) {
		const held = state.value;
		const incoming = restored
			? merged(
					{
						baseline: restored.baseline,
						current: restored.values,
						settled: Object.fromEntries(Object.entries(restored.values).filter(([name]) => !restored.edited.includes(name))),
					},
					held.baseline,
				)
			: held.baseline;
		withoutWriting(() => state.update((value) => ({ ...value, current: mergeObserved(value.current, incoming, local) })));
		return local.size === 0;
	}
	const mounted = Atom.readable((get) => {
		if (persistence) {
			get.addFinalizer(persistence.observe(restore));
		}
	});
	function releaseCleanFields() {
		for (const name of local) {
			if (untouched(state.value, name)) {
				local.delete(name);
			}
		}
	}
	function store(value: Draft<TValues>, sameInput = refreshing) {
		const edited = Object.keys({ ...value.baseline, ...value.current }).filter((name) => !untouched(value, name));
		persistence?.write(settledBaseline(value), value.current, edited, sameInput);
	}
	if (persistence) {
		state.subscribe((value) => {
			const before = previous;
			previous = value.current;
			if (receiving) {
				return;
			}
			if (!refreshing) {
				for (const name of changedFields(before, value.current)) {
					local.add(name);
				}
			}
			releaseCleanFields();
			if (changed(value)) {
				store(value);
			} else {
				persistence.clear();
			}
		});
	}
	return {
		dirty: Atom.readable((get) => {
			get(mounted);
			get.addFinalizer(state.subscribe((value) => get.setSelf(changed(value))));
			return changed(state.value);
		}),
		mounted,
		receive: (incoming: TValues): void => {
			refreshing = true;
			state.update((held) => ({
				baseline: incoming,
				current: changed(held) ? merged(held, incoming) : incoming,
				settled: none,
			}));
			refreshing = false;
			releaseCleanFields();
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
			const revision = persistence?.revision();
			return {
				accept: (incoming?: TValues): void => {
					withoutWriting(() => state.update((held) => accepted(held, baseline, submitted, incoming)));
					releaseCleanFields();
					if (changed(state.value)) {
						store(state.value, true);
					} else {
						const expected = revision?.();
						if (expected !== undefined) {
							persistence?.clear(expected);
						}
					}
				},
				values: submitted,
			};
		},
		values: state.prop("current"),
	};
}
