import * as Atom from "effect/reactivity/Atom";
import * as AtomRef from "effect/reactivity/AtomRef";
import { accepted, changed, type Draft, type Entries, localBaseline, merged, untouched } from "./draftValues.ts";
import type { Persistence, StoredValues } from "./persistence.ts";

export function draft<TValues extends Entries>(initial: TValues, persistence?: Persistence<TValues>) {
	const none: Entries = {};
	const state = AtomRef.make<Draft<TValues>>({ baseline: initial, current: initial, settled: none });
	let observed = initial;
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
		withoutWriting(() => state.update((value) => ({ ...value, current: merged({ ...value, baseline: observed, settled: none }, incoming) })));
		observed = incoming;
		return !changed({ baseline: incoming, current: state.value.current, settled: none });
	}
	const mounted = Atom.readable((get) => {
		if (persistence) {
			get.addFinalizer(persistence.observe(restore));
		}
	});
	function store(value: Draft<TValues>, sameInput = refreshing) {
		const edited = Object.keys({ ...value.baseline, ...value.current }).filter((name) => !untouched(value, name));
		persistence?.write({ ...value.baseline, ...value.settled }, value.current, edited, sameInput);
	}
	if (persistence) {
		state.subscribe((value) => {
			if (receiving) {
				return;
			}
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
			observed = merged({ ...state.value, current: observed }, incoming);
			refreshing = true;
			state.update((held) => ({
				baseline: incoming,
				current: changed(held) ? merged(held, incoming) : incoming,
				settled: none,
			}));
			refreshing = false;
			observed = localBaseline(state.value, observed);
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
					observed = localBaseline(state.value, observed);
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
