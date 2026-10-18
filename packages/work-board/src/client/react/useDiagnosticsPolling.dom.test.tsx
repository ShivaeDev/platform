import * as Atom from "effect/reactivity/Atom";
import { act, useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { renderBoard } from "#test/react.tsx";
import { useDiagnosticsPolling } from "./useDiagnosticsPolling.ts";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();
afterEach(() => vi.restoreAllMocks());

const diagnostics = Atom.make(0);
const fleet = Atom.make(0);
function Poller({ client }: { readonly client: Parameters<typeof useDiagnosticsPolling>[0] }) {
	useDiagnosticsPolling(client, diagnostics, fleet);
	return null;
}
function Mounted({ client }: { readonly client: Parameters<typeof useDiagnosticsPolling>[0] }) {
	const [mounted, setMounted] = useState(true);
	return (
		<>
			<button onClick={() => setMounted(false)} type="button">
				Stop
			</button>
			{mounted ? <Poller client={client} /> : null}
		</>
	);
}
it("refreshes diagnostics and fleet when the supplied client's pause atom resumes, then unsubscribes", async () => {
	const paused = Atom.make(true);
	const refresh = vi.fn();
	const view = await renderBoard({}, (_, registry) => {
		vi.spyOn(registry, "refresh").mockImplementation(refresh);
		return <Mounted client={{ registry, updates: { paused } }} />;
	});
	try {
		expect(refresh).not.toHaveBeenCalled();
		await act(async () => view.registry.set(paused, false));
		expect(refresh.mock.calls).toEqual([[diagnostics], [fleet]]);
		await act(async () => view.registry.set(paused, true));
		expect(refresh).toHaveBeenCalledTimes(2);
		act(() => view.container.querySelector("button")?.click());
		await act(async () => view.registry.set(paused, false));
		expect(refresh).toHaveBeenCalledTimes(2);
	} finally {
		await view.unmount();
	}
});
