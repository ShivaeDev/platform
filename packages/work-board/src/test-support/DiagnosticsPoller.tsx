import { useAtomValue } from "@effect/atom-react";
import type * as Atom from "effect/reactivity/Atom";
import { useState } from "react";
import { useDiagnosticsPolling } from "#client/react/useDiagnosticsPolling.ts";

export function Poller({
	client,
	diagnostics,
	fleet,
}: {
	readonly client: Parameters<typeof useDiagnosticsPolling>[0];
	readonly diagnostics: Atom.Atom<number>;
	readonly fleet: Atom.Atom<number>;
}) {
	useDiagnosticsPolling(client, diagnostics, fleet);
	return null;
}

export function DiagnosticsPoller({ client, diagnostics, fleet }: Parameters<typeof Poller>[0]) {
	const [mounted, setMounted] = useState(true);
	return (
		<>
			<output data-diagnostics>{useAtomValue(diagnostics)}</output>
			<output data-fleet>{useAtomValue(fleet)}</output>
			<button onClick={() => setMounted(false)} type="button">
				Stop
			</button>
			{mounted ? <Poller client={client} diagnostics={diagnostics} fleet={fleet} /> : null}
		</>
	);
}
