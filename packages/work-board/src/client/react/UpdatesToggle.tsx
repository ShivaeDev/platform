import { useAtomSet, useAtomValue } from "@effect/atom-react";
import type { BrowserClient } from "#client/client.ts";
import { shellIds } from "./shellIds.ts";

export function UpdatesToggle({ client }: { readonly client: BrowserClient }) {
	const paused = useAtomValue(client.updates.paused);
	const setPaused = useAtomSet(client.updates.paused);
	return (
		<button aria-pressed={paused} id={shellIds.updatesToggle} onClick={() => setPaused((value) => !value)} type="button">
			{paused ? "Resume updates" : "Pause updates"}
		</button>
	);
}
