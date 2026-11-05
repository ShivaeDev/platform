import type * as Atom from "effect/reactivity/Atom";
import { useState } from "react";
import { useDebouncedValue } from "#client/useDebouncedValue.ts";
import { useDelay } from "#client/useDelay.ts";

export function View({
	runtime,
	debounce = 300,
	delay = 450,
	onSelect,
}: {
	readonly runtime: Atom.AtomRuntime<never>;
	readonly debounce?: number;
	readonly delay?: number;
	readonly onSelect: () => void;
}) {
	const [search, setSearch] = useState("");
	const [selected, select] = useState(false);
	const query = useDebouncedValue(search, debounce, runtime);
	const press = useDelay(delay, runtime);
	const results = query === "" ? "All foods" : `Results for ${query}`;
	return (
		<main>
			<input aria-label="Food search" onChange={(event) => setSearch(event.target.value)} value={search} />
			<output>{results}</output>
			<button
				aria-busy={press.pending}
				onPointerCancel={press.cancel}
				onPointerDown={() =>
					press.start(() => {
						select(true);
						onSelect();
					})
				}
				onPointerLeave={press.cancel}
				onPointerUp={press.cancel}
				type="button"
			>
				{selected ? "Selected diary row" : "Diary row"}
			</button>
		</main>
	);
}
