import { useState } from "react";

export function FetchPage({
	fetch,
	controller,
	loaded,
}: {
	readonly fetch: typeof globalThis.fetch;
	readonly controller: AbortController;
	readonly loaded: (name: string) => void;
}) {
	const [text, setText] = useState("Ready");
	async function load(name: string) {
		try {
			const response = await fetch(`/${name}`, { signal: name === "first" ? controller.signal : null });
			setText(await response.text());
			loaded(name);
		} catch (error) {
			if (!controller.signal.aborted) {
				throw error;
			}
			setText("Cancelled");
		}
	}
	return (
		<main>
			<button onClick={() => load("first")} type="button">
				Load first
			</button>
			<button onClick={() => load("second")} type="button">
				Load second
			</button>
			<button onClick={() => controller.abort()} type="button">
				Cancel first
			</button>
			<output>{text}</output>
		</main>
	);
}
