import type * as Atom from "effect/reactivity/Atom";
import { useState } from "react";
import { useDebouncedValue } from "@shivaedev/react/client/useDebouncedValue.ts";
import { useDelay } from "@shivaedev/react/client/useDelay.ts";

export function TimerSearch({ runtime }: { readonly runtime: Atom.AtomRuntime<never> }) {
	const [input, setInput] = useState("");
	const [selected, select] = useState(false);
	const search = useDebouncedValue(input, 300, runtime);
	const hold = useDelay(450, runtime);
	const results = search === "" ? "All foods" : `Results for ${search}`;
	return (
		<main>
			<input aria-label="Food search" onChange={(event) => setInput(event.target.value)} value={input} />
			<output>{results}</output>
			<button onPointerDown={() => hold.start(() => select(true))} onPointerUp={hold.cancel} type="button">
				{selected ? "Selected diary row" : "Diary row"}
			</button>
		</main>
	);
}
