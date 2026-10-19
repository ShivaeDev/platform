import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Pause, Play } from "lucide-react";
import type { BrowserClient } from "#browserClient.ts";
import { Button } from "#client/react/components/ui/button.tsx";
import { shellIds } from "./shellIds.ts";

export function UpdatesToggle({ client }: { readonly client: { readonly updates: Pick<BrowserClient["updates"], "paused"> } }) {
	const paused = useAtomValue(client.updates.paused);
	const setPaused = useAtomSet(client.updates.paused);
	return (
		<Button aria-pressed={paused} id={shellIds.updatesToggle} onClick={() => setPaused((value) => !value)} type="button" variant="outline">
			{paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
			{paused ? "Resume updates" : "Pause updates"}
		</Button>
	);
}
