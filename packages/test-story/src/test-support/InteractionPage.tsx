import { useState } from "react";

export function InteractionPage() {
	const [focus, setFocus] = useState("Outside");
	const [keys, setKeys] = useState<string[]>([]);
	const [pointer, setPointer] = useState("Away");
	const [hover, setHover] = useState("Away");
	return (
		<main>
			<label>
				Name
				<input
					onBlur={() => setFocus("Outside")}
					onFocus={() => setFocus("Name")}
					onKeyDown={(event) => setKeys((previous) => [...previous, `down ${event.key}${event.ctrlKey ? " with Control" : ""}`])}
					onKeyUp={(event) => setKeys((previous) => [...previous, `up ${event.key}${event.ctrlKey ? " with Control" : ""}`])}
				/>
			</label>
			<button onMouseEnter={() => setHover("Mouse")} onPointerEnter={(event) => setPointer(event.pointerType)} type="button">
				Help
			</button>
			<output aria-label="Focus">{focus}</output>
			<output aria-label="Keys">{keys.join(", ") || "None"}</output>
			<output aria-label="Pointer">{pointer}</output>
			<output aria-label="Hover">{hover}</output>
			<select aria-label="Destination" defaultValue="lon">
				<option value="lon">London</option>
				<option label="Paris" value="par">
					Paris, France
				</option>
			</select>
		</main>
	);
}
