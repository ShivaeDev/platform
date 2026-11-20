import { useAtomMount, useAtomRef, useAtomValue } from "@effect/atom-react";
import * as Atom from "effect/reactivity/Atom";
import type * as AtomRef from "effect/reactivity/AtomRef";
import { useMemo } from "react";

interface ListForm<TKey extends string, TItem> {
	readonly blur: (name: TKey) => void;
	readonly change: (name: TKey, value: readonly TItem[]) => void;
	readonly dirty: Atom.Atom<boolean>;
	readonly error: (name: TKey) => Atom.Atom<string | undefined>;
	readonly errorAt: (path: readonly [TKey, ...PropertyKey[]]) => Atom.Atom<string | undefined>;
	readonly field: (name: TKey) => AtomRef.ReadonlyRef<readonly TItem[]>;
}

export function useList<TKey extends string, TItem>(form: ListForm<NoInfer<TKey>, TItem>, name: TKey) {
	useAtomMount(form.dirty);
	const values = useAtomRef(form.field(name));
	const error = useAtomValue(form.error(name));
	const errors = useAtomValue(
		useMemo(() => Atom.readable((get) => values.map((_, index) => get(form.errorAt([name, index])))), [form, name, values]),
	);
	function change(next: readonly TItem[]) {
		form.change(name, next);
	}
	function current() {
		return form.field(name).value;
	}
	return {
		add: (value: TItem) => change([...current(), value]),
		error,
		items: values.map((value, index) => ({
			error: errors[index],
			onChange: (next: TItem) => change(current().map((item, at) => (at === index ? next : item))),
			onRemove: () => change(current().filter((_, at) => at !== index)),
			value,
		})),
		onBlur: () => form.blur(name),
	};
}
