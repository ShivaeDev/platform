import { Effect } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { act, useState } from "react";
import { afterEach, expect, vi } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { screenStory } from "#test/screenStory.ts";
import { useDiagnosticsPolling } from "./useDiagnosticsPolling.ts";

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
screenStory.it(
	"refreshes diagnostics and fleet when the supplied client's pause atom resumes, then unsubscribes",
	[],
	function* ({ renderBoard, click }) {
		const paused = Atom.make(true);
		const refresh = vi.fn();
		const view = yield* Effect.promise(() =>
			renderBoard({}, (_, registry) => {
				vi.spyOn(registry, "refresh").mockImplementation(refresh);
				return <Mounted client={{ registry, updates: { paused } }} />;
			}),
		);

		expect(refresh).not.toHaveBeenCalled();
		yield* Effect.promise(() => act(async () => view.registry.set(paused, false)));
		expect(refresh.mock.calls).toEqual([[diagnostics], [fleet]]);
		yield* Effect.promise(() => act(async () => view.registry.set(paused, true)));
		expect(refresh).toHaveBeenCalledTimes(2);
		click(view.container.querySelector("button"));
		yield* Effect.promise(() => act(async () => view.registry.set(paused, false)));
		expect(refresh).toHaveBeenCalledTimes(2);
	},
);
