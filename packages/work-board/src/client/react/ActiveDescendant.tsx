import { useCommandState } from "cmdk";
import { type RefObject, useLayoutEffect } from "react";

export function ActiveDescendant({
	inputRef,
	listRef,
}: {
	readonly inputRef: RefObject<HTMLInputElement | null>;
	readonly listRef: RefObject<HTMLDivElement | null>;
}) {
	const value = useCommandState((state) => state.value);
	// cmdk 1.1.1 leaves aria-activedescendant empty when it selects an item on its own. The listbox keeps cmdk's value because focus never leaves the input.
	useLayoutEffect(() => {
		const selected = [...(listRef.current?.querySelectorAll("[cmdk-item]") ?? [])].find((item) => item.getAttribute("data-value") === value);
		if (selected?.id) {
			inputRef.current?.setAttribute("aria-activedescendant", selected.id);
		} else {
			inputRef.current?.removeAttribute("aria-activedescendant");
		}
	}, [value, inputRef, listRef]);
	return null;
}
